use std::sync::Arc;

use serde::Deserialize;
use tauri::{AppHandle, Emitter};

use super::DaemonState;
use crate::models::OllamaStatus;

#[derive(Deserialize, Default)]
struct OllamaTagsResponse {
    #[serde(default)]
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

pub async fn monitor(app_handle: AppHandle, state: Arc<DaemonState>) {
    loop {
        let ollama_url = {
            let config = state.config.lock().await;
            config.ai.ollama_url.clone()
        };

        let status = check_ollama(&ollama_url).await;

        {
            let mut ollama_status = state.ollama_status.lock().await;
            *ollama_status = status.clone();
        }

        app_handle.emit("ollama-status-changed", &status).ok();

        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
    }
}

async fn check_ollama(url: &str) -> OllamaStatus {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    match client.get(format!("{}/api/tags", url)).send().await {
        Ok(resp) => {
            let tags: OllamaTagsResponse = resp.json().await.unwrap_or_default();
            let models = tags.models.iter().map(|m| m.name.clone()).collect();
            OllamaStatus {
                connected: true,
                available_models: models,
            }
        }
        Err(_) => OllamaStatus {
            connected: false,
            available_models: vec![],
        },
    }
}
