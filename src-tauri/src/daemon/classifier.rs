use std::sync::Arc;
use std::time::Duration;

use regex::Regex;
use serde::{Deserialize, Serialize};

use super::DaemonState;
use crate::models::{ClassificationResult, NlpParsedEntry};

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    format: String,
    think: bool,
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
    duration_seconds: i64,
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
    match classify_with_ollama(state, app_name, window_title, bundle_id, browser_url, duration_seconds).await {
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
    duration_seconds: i64,
) -> Result<ClassificationResult, Box<dyn std::error::Error + Send + Sync>> {
    let config = state.config.lock().await;
    let ollama_url = config.ai.ollama_url.clone();
    let model = config.ai.tier1_model.clone();
    let timeout_ms = config.ai.classify_timeout_ms;
    drop(config);

    classify_with_ollama_model(
        &ollama_url, &model, timeout_ms,
        app_name, window_title, bundle_id, browser_url, duration_seconds,
    ).await
}

async fn classify_with_ollama_model(
    ollama_url: &str,
    model: &str,
    timeout_ms: u64,
    app_name: &str,
    window_title: &str,
    bundle_id: &str,
    browser_url: Option<&str>,
    duration_seconds: i64,
) -> Result<ClassificationResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut user_input = serde_json::json!({
        "app": app_name,
        "title": window_title,
        "bundle_id": bundle_id,
        "duration_so_far_seconds": duration_seconds,
    });

    if let Some(url) = browser_url {
        user_input["url"] = serde_json::Value::String(url.to_string());
    }

    let request = OllamaRequest {
        model: model.to_string(),
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
        think: false,
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

// --- Model lifecycle management ---

async fn set_model_keep_alive(
    ollama_url: &str,
    model: &str,
    keep_alive: &str,
) {
    let client = reqwest::Client::new();
    let _ = client
        .post(format!("{}/api/generate", ollama_url))
        .json(&serde_json::json!({
            "model": model,
            "keep_alive": keep_alive,
        }))
        .send()
        .await;
}

async fn unload_model(ollama_url: &str, model: &str) {
    log::info!("Unloading model: {}", model);
    set_model_keep_alive(ollama_url, model, "0").await;
}

async fn load_model_permanent(ollama_url: &str, model: &str) {
    log::info!("Loading model (permanent): {}", model);
    set_model_keep_alive(ollama_url, model, "-1").await;
}

async fn load_model_temp(ollama_url: &str, model: &str) {
    log::info!("Loading model (10m): {}", model);
    set_model_keep_alive(ollama_url, model, "10m").await;
}

// --- Tier 2: Batch reclassification ---

pub async fn batch_reclassify(state: &Arc<DaemonState>) -> Result<usize, String> {
    let config = state.config.lock().await;
    let ollama_url = config.ai.ollama_url.clone();
    let tier1 = config.ai.tier1_model.clone();
    let tier2 = config.ai.tier2_model.clone();
    let timeout = config.ai.classify_timeout_ms;
    drop(config);

    let pending = state.db.get_pending_events().map_err(|e| e.to_string())?;
    if pending.is_empty() {
        return Ok(0);
    }

    log::info!("Tier 2 batch: {} pending events to reclassify", pending.len());

    // Model swap: unload Tier 1, load Tier 2
    unload_model(&ollama_url, &tier1).await;
    load_model_temp(&ollama_url, &tier2).await;

    let mut reclassified = 0;

    for event in &pending {
        match classify_with_ollama_model(
            &ollama_url,
            &tier2,
            timeout,
            &event.app_name,
            event.window_title.as_deref().unwrap_or(""),
            &event.app_bundle_id,
            event.browser_url.as_deref(),
            event.duration_seconds,
        )
        .await
        {
            Ok(result) => {
                let source = if result.confidence >= 0.5 {
                    "llm"
                } else {
                    "pending"
                };
                if state
                    .db
                    .update_event_classification(event.id, &result, source)
                    .is_ok()
                {
                    reclassified += 1;
                }
            }
            Err(e) => {
                log::warn!("Tier 2 reclassify failed for event {}: {}", event.id, e);
            }
        }
    }

    // Model swap back: unload Tier 2, reload Tier 1
    unload_model(&ollama_url, &tier2).await;
    load_model_permanent(&ollama_url, &tier1).await;

    log::info!("Tier 2 batch complete: {}/{} reclassified", reclassified, pending.len());
    Ok(reclassified)
}

// --- Tier 2: Daily summary ---

const SUMMARY_PROMPT: &str = r#"You are a productivity summarizer. Given a day's tracked work events, generate a concise summary.
Return ONLY JSON:
{
  "total_hours": <float>,
  "top_category": "<category>",
  "top_project": "<project or 'Various'>",
  "summary": "<1-2 sentence summary of the day>",
  "productivity_score": <1-10>
}"#;

pub async fn generate_daily_summary(
    state: &Arc<DaemonState>,
    date: &str,
) -> Result<String, String> {
    let config = state.config.lock().await;
    let ollama_url = config.ai.ollama_url.clone();
    let tier1 = config.ai.tier1_model.clone();
    let tier2 = config.ai.tier2_model.clone();
    let timeout = config.ai.classify_timeout_ms;
    drop(config);

    let events = state.db.get_events_for_date(date).map_err(|e| e.to_string())?;
    if events.is_empty() {
        return Err("No events for this date".to_string());
    }

    // Build aggregated input for the summary model
    let total_seconds: i64 = events.iter().map(|e| e.duration_seconds).sum();
    let total_hours = total_seconds as f64 / 3600.0;

    let mut category_map: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();
    let mut project_map: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();
    let mut app_map: std::collections::HashMap<String, f64> =
        std::collections::HashMap::new();

    for event in &events {
        let hours = event.duration_seconds as f64 / 3600.0;
        let cat = event.category.clone().unwrap_or_else(|| "unknown".to_string());
        let proj = event.project.clone().unwrap_or_else(|| "Unclassified".to_string());
        *category_map.entry(cat).or_default() += hours;
        *project_map.entry(proj).or_default() += hours;
        *app_map.entry(event.app_name.clone()).or_default() += hours;
    }

    let summary_input = serde_json::json!({
        "date": date,
        "total_hours": format!("{:.1}", total_hours),
        "event_count": events.len(),
        "categories": category_map,
        "projects": project_map,
        "top_apps": app_map,
    });

    // Model swap
    unload_model(&ollama_url, &tier1).await;
    load_model_temp(&ollama_url, &tier2).await;

    let request = OllamaRequest {
        model: tier2.clone(),
        messages: vec![
            OllamaMessage {
                role: "system".to_string(),
                content: SUMMARY_PROMPT.to_string(),
            },
            OllamaMessage {
                role: "user".to_string(),
                content: serde_json::to_string(&summary_input).unwrap_or_default(),
            },
        ],
        stream: false,
        format: "json".to_string(),
        think: false,
        options: OllamaOptions {
            temperature: 0.3,
            num_predict: 300,
        },
    };

    let client = reqwest::Client::new();
    let result = tokio::time::timeout(
        Duration::from_millis(timeout * 3), // longer timeout for summary
        client
            .post(format!("{}/api/chat", ollama_url))
            .json(&request)
            .send(),
    )
    .await
    .map_err(|_| "Summary generation timed out".to_string())?
    .map_err(|e| e.to_string())?;

    let ollama_response: OllamaResponse = result.json().await.map_err(|e| e.to_string())?;
    let content = ollama_response
        .message
        .ok_or("No message in summary response")?
        .content;

    // Store in summaries table
    state
        .db
        .insert_summary("daily", date, date, &content)
        .map_err(|e| e.to_string())?;

    // Model swap back
    unload_model(&ollama_url, &tier2).await;
    load_model_permanent(&ollama_url, &tier1).await;

    log::info!("Daily summary generated for {}", date);
    Ok(content)
}

// --- NLP time entry parsing ---

const NLP_SYSTEM_PROMPT: &str = r#"You parse natural language time entries into JSON. Today is {today}.
Return a JSON array: [{"date":"YYYY-MM-DD", "duration_minutes":<int>,
"category":"<coding|communication|design|documentation|browsing|meeting|admin|entertainment>",
"project":"<name or null>", "task_description":"<short>"}]
If user says "yesterday" or "igår", use {yesterday}. If they say "idag" or "today", use {today}.
Estimate duration if vague (e.g. "a bit" = 30min, "morning" = 3h).
Swedish and English input both supported. Always respond with JSON array only."#;

pub async fn parse_nlp_time_entry(
    state: &Arc<DaemonState>,
    input: &str,
) -> Result<Vec<NlpParsedEntry>, String> {
    let config = state.config.lock().await;
    let ollama_url = config.ai.ollama_url.clone();
    let tier1 = config.ai.tier1_model.clone();
    let tier2 = config.ai.tier2_model.clone();
    let timeout = config.ai.classify_timeout_ms;
    drop(config);

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let yesterday = (chrono::Local::now() - chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();

    let system_prompt = NLP_SYSTEM_PROMPT
        .replace("{today}", &today)
        .replace("{yesterday}", &yesterday);

    // Model swap: use Tier 2 for NLP parsing
    unload_model(&ollama_url, &tier1).await;
    load_model_temp(&ollama_url, &tier2).await;

    let request = OllamaRequest {
        model: tier2.clone(),
        messages: vec![
            OllamaMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            OllamaMessage {
                role: "user".to_string(),
                content: input.to_string(),
            },
        ],
        stream: false,
        format: "json".to_string(),
        think: false,
        options: OllamaOptions {
            temperature: 0.1,
            num_predict: 500,
        },
    };

    let client = reqwest::Client::new();
    let response = tokio::time::timeout(
        Duration::from_millis(timeout * 3),
        client
            .post(format!("{}/api/chat", ollama_url))
            .json(&request)
            .send(),
    )
    .await
    .map_err(|_| "NLP parsing timed out".to_string())?
    .map_err(|e| e.to_string())?;

    let ollama_response: OllamaResponse = response.json().await.map_err(|e| e.to_string())?;
    let content = ollama_response
        .message
        .ok_or("No message in NLP response")?
        .content;

    // Model swap back
    unload_model(&ollama_url, &tier2).await;
    load_model_permanent(&ollama_url, &tier1).await;

    // Parse response — try as array first, then as object wrapping an array
    if let Ok(entries) = serde_json::from_str::<Vec<NlpParsedEntry>>(&content) {
        return Ok(entries);
    }

    // Some models wrap in {"entries": [...]} or similar
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
        // Try to find any array in the top-level object
        if let Some(obj) = val.as_object() {
            for (_key, value) in obj {
                if let Ok(entries) = serde_json::from_value::<Vec<NlpParsedEntry>>(value.clone()) {
                    return Ok(entries);
                }
            }
        }
        // Try as single entry wrapped in object
        if let Ok(entry) = serde_json::from_value::<NlpParsedEntry>(val) {
            return Ok(vec![entry]);
        }
    }

    Err(format!("Failed to parse NLP response: {}", content))
}
