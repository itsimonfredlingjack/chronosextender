use std::collections::HashMap;
use std::sync::Arc;

use chrono::{Duration, Local};
use futures_util::StreamExt;
use keyring::{Entry, Error as KeyringError};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::daemon::cloud::ParsedDailySummary;
use crate::daemon::DaemonState;
use crate::models::{
    AssistantContextEvent, AssistantContextSnapshot, AssistantHistoryMessage,
    AssistantProjectTotal, AssistantRecentSummary, AssistantSecretStatus,
    AssistantStreamEventPayload, AssistantStreamRequest,
};

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const ANTHROPIC_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const KEYRING_SERVICE: &str = "dev.chronos.assistant";

#[derive(Debug)]
enum ProviderStreamEvent {
    Delta(String),
    Completed,
    Error(String),
}

pub async fn build_context_snapshot(
    state: &Arc<DaemonState>,
) -> Result<AssistantContextSnapshot, String> {
    let today = Local::now().date_naive();
    let today_string = today.format("%Y-%m-%d").to_string();
    let week_start = (today - Duration::days(6)).format("%Y-%m-%d").to_string();

    let today_events = state
        .db
        .get_events_for_date(&today_string)
        .map_err(|error| error.to_string())?;
    let week_events = state
        .db
        .get_events_for_date_range(&week_start, &today_string)
        .map_err(|error| error.to_string())?;
    let pending_count = state
        .db
        .get_pending_events()
        .map_err(|error| error.to_string())?
        .len();
    let flow_minutes = state.flow_status.lock().await.duration_minutes;

    let mut project_totals = HashMap::<String, i64>::new();
    for event in &week_events {
        let project = event
            .project
            .clone()
            .unwrap_or_else(|| "Unclassified".to_string());
        *project_totals.entry(project).or_default() += event.duration_seconds;
    }

    let mut top_projects = project_totals
        .into_iter()
        .map(|(project, seconds)| AssistantProjectTotal { project, seconds })
        .collect::<Vec<_>>();
    top_projects.sort_by(|left, right| right.seconds.cmp(&left.seconds));
    top_projects.truncate(5);

    let recent_events = week_events
        .iter()
        .rev()
        .take(6)
        .map(|event| AssistantContextEvent {
            start_time: event.start_time.clone(),
            end_time: event.end_time.clone(),
            project: event.project.clone(),
            category: event.category.clone(),
            app_name: event.app_name.clone(),
            task_description: event.task_description.clone(),
        })
        .collect::<Vec<_>>();

    let summary_dates = state
        .db
        .get_summary_dates_since(Some(&week_start))
        .map_err(|error| error.to_string())?;
    let mut recent_summaries = Vec::new();
    for date in summary_dates.into_iter().rev().take(4) {
        let Some(summary) = state
            .db
            .get_daily_summary(&date)
            .map_err(|error| error.to_string())?
        else {
            continue;
        };

        let Ok(parsed) = serde_json::from_str::<ParsedDailySummary>(&summary.summary_json) else {
            continue;
        };

        recent_summaries.push(AssistantRecentSummary {
            date: summary.period_start,
            total_hours: parsed.total_hours,
            top_category: parsed.top_category,
            top_project: parsed.top_project,
            summary: parsed.summary,
            productivity_score: parsed.productivity_score,
        });
    }

    Ok(AssistantContextSnapshot {
        current_date: today_string,
        today_total_seconds: today_events
            .iter()
            .map(|event| event.duration_seconds)
            .sum(),
        week_total_seconds: week_events.iter().map(|event| event.duration_seconds).sum(),
        today_event_count: today_events.len(),
        pending_count,
        current_flow_minutes: flow_minutes,
        top_projects,
        recent_events,
        recent_summaries,
    })
}

pub fn assistant_secret_status(provider: &str) -> Result<AssistantSecretStatus, String> {
    if provider == "local" {
        return Ok(AssistantSecretStatus {
            provider: provider.to_string(),
            configured: true,
        });
    }

    let configured = match assistant_keyring_entry(provider)?.get_password() {
        Ok(password) => !password.trim().is_empty(),
        Err(KeyringError::NoEntry) => false,
        Err(error) => return Err(error.to_string()),
    };

    Ok(AssistantSecretStatus {
        provider: provider.to_string(),
        configured,
    })
}

pub fn set_assistant_api_key(provider: &str, api_key: &str) -> Result<(), String> {
    if provider == "local" {
        return Ok(());
    }

    if api_key.trim().is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    assistant_keyring_entry(provider)?
        .set_password(api_key)
        .map_err(|error| error.to_string())
}

pub fn clear_assistant_api_key(provider: &str) -> Result<(), String> {
    if provider == "local" {
        return Ok(());
    }

    match assistant_keyring_entry(provider)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

pub async fn start_stream(
    app: AppHandle,
    state: Arc<DaemonState>,
    request: AssistantStreamRequest,
) -> Result<(), String> {
    let settings = state.config.lock().await.assistant.clone();
    if !settings.enabled {
        return Err("The embedded assistant is disabled in Settings.".to_string());
    }
    if request.user_message.trim().is_empty() {
        return Err("Message cannot be empty.".to_string());
    }

    let provider = settings.provider.clone();
    let api_key = match provider.as_str() {
        "local" => None,
        _ => Some(read_assistant_api_key(&provider)?),
    };

    let request_id = request.request_id.clone();
    let state_for_cleanup = state.clone();
    let app_for_stream = app.clone();
    let handle = tokio::spawn(async move {
        let stream_result = match provider.as_str() {
            "openai" => {
                stream_openai_response(
                    &app_for_stream,
                    &request_id,
                    &settings.model,
                    settings.temperature,
                    &settings.system_prompt,
                    &request.history,
                    &request.context_xml,
                    &request.user_message,
                    api_key.as_deref().unwrap_or_default(),
                )
                .await
            }
            "anthropic" => {
                stream_anthropic_response(
                    &app_for_stream,
                    &request_id,
                    &settings.model,
                    settings.temperature,
                    &settings.system_prompt,
                    &request.history,
                    &request.context_xml,
                    &request.user_message,
                    api_key.as_deref().unwrap_or_default(),
                )
                .await
            }
            "local" => {
                stream_local_response(
                    &app_for_stream,
                    &request_id,
                    &settings.model,
                    settings.temperature,
                    &settings.system_prompt,
                    &request.history,
                    &request.context_xml,
                    &request.user_message,
                    &settings.local_base_url,
                )
                .await
            }
            other => Err(format!("Unsupported assistant provider: {other}")),
        };

        if let Err(error) = stream_result {
            emit_stream_event(
                &app_for_stream,
                AssistantStreamEventPayload {
                    request_id: request_id.clone(),
                    event_type: "response.error".to_string(),
                    delta: None,
                    error: Some(error),
                },
            );
        }

        state_for_cleanup
            .assistant_streams
            .lock()
            .await
            .remove(&request_id);
    });

    let mut streams = state.assistant_streams.lock().await;
    if let Some(existing) = streams.remove(&request.request_id) {
        existing.abort();
    }
    streams.insert(request.request_id, handle);
    Ok(())
}

pub async fn cancel_stream(state: &Arc<DaemonState>, request_id: &str) -> Result<bool, String> {
    let mut streams = state.assistant_streams.lock().await;
    if let Some(handle) = streams.remove(request_id) {
        handle.abort();
        return Ok(true);
    }

    Ok(false)
}

fn assistant_keyring_entry(provider: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, &format!("chronos-{provider}")).map_err(|error| error.to_string())
}

fn read_assistant_api_key(provider: &str) -> Result<String, String> {
    match assistant_keyring_entry(provider)?.get_password() {
        Ok(password) if !password.trim().is_empty() => Ok(password),
        Ok(_) | Err(KeyringError::NoEntry) => {
            Err(format!("No API key is stored for the {provider} provider."))
        }
        Err(error) => Err(error.to_string()),
    }
}

async fn stream_openai_response(
    app: &AppHandle,
    request_id: &str,
    model: &str,
    temperature: f64,
    system_prompt: &str,
    history: &[AssistantHistoryMessage],
    context_xml: &str,
    user_message: &str,
    api_key: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post(OPENAI_RESPONSES_URL)
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "instructions": system_prompt,
            "temperature": temperature,
            "stream": true,
            "input": openai_input(history, context_xml, user_message),
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI request failed with {status}: {body}"));
    }

    pump_sse_stream(app, request_id, response, parse_openai_event).await
}

async fn stream_anthropic_response(
    app: &AppHandle,
    request_id: &str,
    model: &str,
    temperature: f64,
    system_prompt: &str,
    history: &[AssistantHistoryMessage],
    context_xml: &str,
    user_message: &str,
    api_key: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post(ANTHROPIC_MESSAGES_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": model,
            "system": system_prompt,
            "temperature": temperature,
            "max_tokens": 600,
            "stream": true,
            "messages": anthropic_messages(history, context_xml, user_message),
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic request failed with {status}: {body}"));
    }

    pump_sse_stream(app, request_id, response, parse_anthropic_event).await
}

async fn stream_local_response(
    app: &AppHandle,
    request_id: &str,
    model: &str,
    temperature: f64,
    system_prompt: &str,
    history: &[AssistantHistoryMessage],
    context_xml: &str,
    user_message: &str,
    local_base_url: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let endpoint = local_chat_endpoint(local_base_url);
    let response = client
        .post(endpoint)
        .json(&json!({
            "model": model,
            "temperature": temperature,
            "stream": true,
            "messages": local_messages(system_prompt, history, context_xml, user_message),
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Local model request failed with {status}: {body}"));
    }

    pump_sse_stream(app, request_id, response, parse_local_event).await
}

async fn pump_sse_stream(
    app: &AppHandle,
    request_id: &str,
    response: reqwest::Response,
    parser: fn(&str) -> Result<Vec<ProviderStreamEvent>, String>,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text.replace("\r\n", "\n"));

        while let Some(frame) = next_sse_frame(&mut buffer) {
            for event in parser(&frame)? {
                match event {
                    ProviderStreamEvent::Delta(delta) => emit_stream_event(
                        app,
                        AssistantStreamEventPayload {
                            request_id: request_id.to_string(),
                            event_type: "response.output_text.delta".to_string(),
                            delta: Some(delta),
                            error: None,
                        },
                    ),
                    ProviderStreamEvent::Completed => emit_stream_event(
                        app,
                        AssistantStreamEventPayload {
                            request_id: request_id.to_string(),
                            event_type: "response.completed".to_string(),
                            delta: None,
                            error: None,
                        },
                    ),
                    ProviderStreamEvent::Error(error) => emit_stream_event(
                        app,
                        AssistantStreamEventPayload {
                            request_id: request_id.to_string(),
                            event_type: "response.error".to_string(),
                            delta: None,
                            error: Some(error),
                        },
                    ),
                }
            }
        }
    }

    if !buffer.trim().is_empty() {
        for event in parser(&buffer)? {
            match event {
                ProviderStreamEvent::Delta(delta) => emit_stream_event(
                    app,
                    AssistantStreamEventPayload {
                        request_id: request_id.to_string(),
                        event_type: "response.output_text.delta".to_string(),
                        delta: Some(delta),
                        error: None,
                    },
                ),
                ProviderStreamEvent::Completed => emit_stream_event(
                    app,
                    AssistantStreamEventPayload {
                        request_id: request_id.to_string(),
                        event_type: "response.completed".to_string(),
                        delta: None,
                        error: None,
                    },
                ),
                ProviderStreamEvent::Error(error) => emit_stream_event(
                    app,
                    AssistantStreamEventPayload {
                        request_id: request_id.to_string(),
                        event_type: "response.error".to_string(),
                        delta: None,
                        error: Some(error),
                    },
                ),
            }
        }
    }

    Ok(())
}

fn next_sse_frame(buffer: &mut String) -> Option<String> {
    let index = buffer.find("\n\n")?;
    let frame = buffer[..index].to_string();
    buffer.drain(..index + 2);
    Some(frame)
}

fn parse_openai_event(frame: &str) -> Result<Vec<ProviderStreamEvent>, String> {
    let (event_name, data) = parse_sse_frame(frame);
    if data.is_empty() {
        return Ok(Vec::new());
    }
    if data == "[DONE]" {
        return Ok(vec![ProviderStreamEvent::Completed]);
    }

    let parsed = serde_json::from_str::<Value>(&data).map_err(|error| error.to_string())?;
    let event_type = event_name
        .or_else(|| {
            parsed
                .get("type")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_default();

    match event_type.as_str() {
        "response.output_text.delta" => Ok(parsed
            .get("delta")
            .and_then(Value::as_str)
            .map(|delta| vec![ProviderStreamEvent::Delta(delta.to_string())])
            .unwrap_or_default()),
        "response.completed" => Ok(vec![ProviderStreamEvent::Completed]),
        "response.error" | "response.failed" | "error" => Ok(vec![ProviderStreamEvent::Error(
            parsed
                .pointer("/error/message")
                .and_then(Value::as_str)
                .or_else(|| parsed.get("message").and_then(Value::as_str))
                .unwrap_or("OpenAI streaming request failed")
                .to_string(),
        )]),
        _ => Ok(Vec::new()),
    }
}

fn parse_anthropic_event(frame: &str) -> Result<Vec<ProviderStreamEvent>, String> {
    let (event_name, data) = parse_sse_frame(frame);
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let parsed = serde_json::from_str::<Value>(&data).map_err(|error| error.to_string())?;
    let event_type = event_name
        .or_else(|| {
            parsed
                .get("type")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_default();

    match event_type.as_str() {
        "content_block_delta" => Ok(parsed
            .pointer("/delta/text")
            .and_then(Value::as_str)
            .map(|delta| vec![ProviderStreamEvent::Delta(delta.to_string())])
            .unwrap_or_default()),
        "message_stop" => Ok(vec![ProviderStreamEvent::Completed]),
        "error" => Ok(vec![ProviderStreamEvent::Error(
            parsed
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("Anthropic streaming request failed")
                .to_string(),
        )]),
        _ => Ok(Vec::new()),
    }
}

fn parse_local_event(frame: &str) -> Result<Vec<ProviderStreamEvent>, String> {
    let (_event_name, data) = parse_sse_frame(frame);
    if data.is_empty() {
        return Ok(Vec::new());
    }
    if data == "[DONE]" {
        return Ok(vec![ProviderStreamEvent::Completed]);
    }

    let parsed = serde_json::from_str::<Value>(&data).map_err(|error| error.to_string())?;
    if let Some(error) = parsed.pointer("/error/message").and_then(Value::as_str) {
        return Ok(vec![ProviderStreamEvent::Error(error.to_string())]);
    }
    if let Some(delta) = parsed
        .pointer("/choices/0/delta/content")
        .and_then(Value::as_str)
    {
        return Ok(vec![ProviderStreamEvent::Delta(delta.to_string())]);
    }
    if parsed
        .pointer("/choices/0/finish_reason")
        .is_some_and(|value| !value.is_null())
    {
        return Ok(vec![ProviderStreamEvent::Completed]);
    }

    Ok(Vec::new())
}

fn parse_sse_frame(frame: &str) -> (Option<String>, String) {
    let mut event_name = None;
    let mut data_lines = Vec::new();

    for line in frame.lines() {
        if let Some(rest) = line.strip_prefix("event:") {
            event_name = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("data:") {
            data_lines.push(rest.trim_start().to_string());
        }
    }

    (event_name, data_lines.join("\n"))
}

fn openai_input(
    history: &[AssistantHistoryMessage],
    context_xml: &str,
    user_message: &str,
) -> Vec<Value> {
    history
        .iter()
        .map(|message| {
            json!({
                "role": message.role,
                "content": [
                    {
                        "type": "input_text",
                        "text": message.content,
                    }
                ]
            })
        })
        .chain(std::iter::once(json!({
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": format!("{context_xml}\n\n{user_message}"),
                }
            ]
        })))
        .collect()
}

fn anthropic_messages(
    history: &[AssistantHistoryMessage],
    context_xml: &str,
    user_message: &str,
) -> Vec<Value> {
    history
        .iter()
        .map(|message| {
            json!({
                "role": message.role,
                "content": message.content,
            })
        })
        .chain(std::iter::once(json!({
            "role": "user",
            "content": format!("{context_xml}\n\n{user_message}"),
        })))
        .collect()
}

fn local_messages(
    system_prompt: &str,
    history: &[AssistantHistoryMessage],
    context_xml: &str,
    user_message: &str,
) -> Vec<Value> {
    std::iter::once(json!({
        "role": "system",
        "content": system_prompt,
    }))
    .chain(history.iter().map(|message| {
        json!({
            "role": message.role,
            "content": message.content,
        })
    }))
    .chain(std::iter::once(json!({
        "role": "user",
        "content": format!("{context_xml}\n\n{user_message}"),
    })))
    .collect()
}

fn local_chat_endpoint(local_base_url: &str) -> String {
    if local_base_url.ends_with("/chat/completions") {
        return local_base_url.to_string();
    }

    format!(
        "{}/v1/chat/completions",
        local_base_url.trim_end_matches('/')
    )
}

fn emit_stream_event(app: &AppHandle, payload: AssistantStreamEventPayload) {
    app.emit("assistant-stream-event", payload).ok();
}
