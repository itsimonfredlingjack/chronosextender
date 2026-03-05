use std::sync::Arc;
use std::time::Duration;

use regex::Regex;
use serde::{Deserialize, Serialize};

use super::DaemonState;
use crate::models::ClassificationResult;

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    format: String,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OllamaOptions {
    temperature: f64,
    num_predict: u32,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: Option<OllamaResponseMessage>,
}

#[derive(Deserialize)]
struct OllamaResponseMessage {
    content: String,
}

const SYSTEM_PROMPT: &str = r#"You are a time classifier. You receive metadata about an active window.
Return ONLY JSON, nothing else.

Respond with:
{
  "project": "<project name or 'unknown'>",
  "category": "<coding|communication|design|documentation|browsing|meeting|admin|entertainment|unknown>",
  "task_description": "<short description, max 10 words>",
  "confidence": <0.0-1.0>,
  "billable": <true|false>
}

Rules:
- If window title contains an issue number (e.g. PROJ-1234), extract it as project
- VS Code / terminals / IDEs = coding
- Slack / Teams / Discord = communication
- Figma / Sketch = design
- Google Docs / Notion / Confluence = documentation
- Zoom / Meet / FaceTime = meeting
- If unsure, set confidence < 0.5 and project = "unknown""#;

pub async fn classify_event(
    state: &Arc<DaemonState>,
    event_id: i64,
    app_name: &str,
    window_title: &str,
    bundle_id: &str,
    browser_url: Option<&str>,
) {
    // Step 1: Try rules first
    if let Ok(rules) = state.db.get_rules_ordered() {
        for rule in &rules {
            if let Some(result) = try_rule(rule, app_name, window_title, bundle_id, browser_url) {
                if let Err(e) = state.db.update_event_classification(event_id, &result, "rule") {
                    log::error!("Failed to update classification for event {}: {}", event_id, e);
                }
                return;
            }
        }
    }

    // Step 2: Try Ollama LLM
    match classify_with_ollama(state, app_name, window_title, bundle_id, browser_url).await {
        Ok(result) => {
            let config = state.config.lock().await;
            let source = if result.confidence >= config.ai.min_confidence_threshold {
                "llm"
            } else {
                "pending"
            };
            if let Err(e) = state.db.update_event_classification(event_id, &result, source) {
                log::error!("Failed to update classification for event {}: {}", event_id, e);
            }
        }
        Err(e) => {
            log::warn!("Ollama classification failed for event {}: {}", event_id, e);
            // Step 3: Mark as pending
            let pending = ClassificationResult {
                project: None,
                category: "unknown".to_string(),
                task_description: None,
                confidence: 0.0,
                billable: false,
            };
            state
                .db
                .update_event_classification(event_id, &pending, "pending")
                .ok();
        }
    }
}

fn try_rule(
    rule: &crate::models::Rule,
    app_name: &str,
    window_title: &str,
    bundle_id: &str,
    browser_url: Option<&str>,
) -> Option<ClassificationResult> {
    let matched = match rule.match_type.as_str() {
        "app_name" => app_name.eq_ignore_ascii_case(&rule.match_value),
        "title_contains" => window_title
            .to_lowercase()
            .contains(&rule.match_value.to_lowercase()),
        "title_regex" => Regex::new(&rule.match_value)
            .ok()
            .map(|re| re.is_match(window_title))
            .unwrap_or(false),
        "url_contains" => browser_url
            .map(|url| url.to_lowercase().contains(&rule.match_value.to_lowercase()))
            .unwrap_or(false),
        "bundle_id" => bundle_id.eq_ignore_ascii_case(&rule.match_value),
        _ => false,
    };

    if matched {
        Some(ClassificationResult {
            project: None, // Rules set category; project can be looked up from target_project_id
            category: rule
                .target_category
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
            task_description: None,
            confidence: 1.0,
            billable: false,
        })
    } else {
        None
    }
}

async fn classify_with_ollama(
    state: &Arc<DaemonState>,
    app_name: &str,
    window_title: &str,
    bundle_id: &str,
    browser_url: Option<&str>,
) -> Result<ClassificationResult, Box<dyn std::error::Error + Send + Sync>> {
    let config = state.config.lock().await;
    let ollama_url = config.ai.ollama_url.clone();
    let model = config.ai.tier1_model.clone();
    let timeout_ms = config.ai.classify_timeout_ms;
    drop(config);

    let mut user_input = serde_json::json!({
        "app": app_name,
        "title": window_title,
        "bundle_id": bundle_id,
    });

    if let Some(url) = browser_url {
        user_input["url"] = serde_json::Value::String(url.to_string());
    }

    let request = OllamaRequest {
        model,
        messages: vec![
            OllamaMessage {
                role: "system".to_string(),
                content: SYSTEM_PROMPT.to_string(),
            },
            OllamaMessage {
                role: "user".to_string(),
                content: serde_json::to_string(&user_input)?,
            },
        ],
        stream: false,
        format: "json".to_string(),
        options: OllamaOptions {
            temperature: 0.1,
            num_predict: 200,
        },
    };

    let client = reqwest::Client::new();
    let response = tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        client
            .post(format!("{}/api/chat", ollama_url))
            .json(&request)
            .send(),
    )
    .await??;

    let ollama_response: OllamaResponse = response.json().await?;
    let content = ollama_response
        .message
        .ok_or("No message in Ollama response")?
        .content;

    parse_classification(&content)
}

fn parse_classification(
    content: &str,
) -> Result<ClassificationResult, Box<dyn std::error::Error + Send + Sync>> {
    // Try direct JSON parse first
    if let Ok(result) = serde_json::from_str::<ClassificationResult>(content) {
        return Ok(result);
    }

    // Fallback: try to extract fields with regex
    let project = extract_json_string(content, "project");
    let category = extract_json_string(content, "category").unwrap_or_else(|| "unknown".to_string());
    let task_description = extract_json_string(content, "task_description");
    let confidence = extract_json_number(content, "confidence").unwrap_or(0.3);
    let billable = extract_json_bool(content, "billable").unwrap_or(false);

    Ok(ClassificationResult {
        project,
        category,
        task_description,
        confidence,
        billable,
    })
}

fn extract_json_string(content: &str, key: &str) -> Option<String> {
    let pattern = format!(r#""{}":\s*"([^"]*)"#, regex::escape(key));
    Regex::new(&pattern)
        .ok()?
        .captures(content)?
        .get(1)
        .map(|m| m.as_str().to_string())
}

fn extract_json_number(content: &str, key: &str) -> Option<f64> {
    let pattern = format!(r#""{}":\s*([\d.]+)"#, regex::escape(key));
    Regex::new(&pattern)
        .ok()?
        .captures(content)?
        .get(1)?
        .as_str()
        .parse()
        .ok()
}

fn extract_json_bool(content: &str, key: &str) -> Option<bool> {
    let pattern = format!(r#""{}":\s*(true|false)"#, regex::escape(key));
    Regex::new(&pattern)
        .ok()?
        .captures(content)?
        .get(1)?
        .as_str()
        .parse()
        .ok()
}
