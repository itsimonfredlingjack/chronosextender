use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub tracking: TrackingConfig,
    pub ai: AiConfig,
    pub flow_guard: FlowGuardConfig,
    pub ui: UiConfig,
    #[serde(default)]
    pub cloud: CloudConfig,
    #[serde(default)]
    pub assistant: AssistantConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingConfig {
    pub enabled: bool,
    pub dedup_threshold_seconds: u64,
    pub poll_interval_ms: u64,
}

impl Default for TrackingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            dedup_threshold_seconds: 3,
            poll_interval_ms: 1000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub ollama_url: String,
    pub tier1_model: String,
    pub tier2_model: String,
    pub classify_timeout_ms: u64,
    pub min_confidence_threshold: f64,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            ollama_url: "http://localhost:11434".to_string(),
            tier1_model: "qwen3.5:0.8b".to_string(),
            tier2_model: "qwen3.5:4b".to_string(),
            classify_timeout_ms: 5000,
            min_confidence_threshold: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowGuardConfig {
    pub enabled: bool,
    pub threshold_minutes: u64,
    pub interrupt_apps: Vec<String>,
}

impl Default for FlowGuardConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            threshold_minutes: 20,
            interrupt_apps: vec![
                "com.tinyspeck.slackmacgap".to_string(),
                "com.apple.MobileSMS".to_string(),
                "com.apple.mail".to_string(),
                "com.hnc.Discord".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    pub theme: String,
    pub show_in_tray: bool,
    pub show_current_activity_in_tray: bool,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            show_in_tray: true,
            show_current_activity_in_tray: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudConfig {
    pub enabled: bool,
    pub base_url: String,
    pub sync_token: String,
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantConfig {
    pub enabled: bool,
    pub provider: String,
    pub model: String,
    pub temperature: f64,
    pub system_prompt: String,
    pub local_base_url: String,
}

impl Default for CloudConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: String::new(),
            sync_token: String::new(),
            last_sync_at: None,
        }
    }
}

impl Default for AssistantConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: "openai".to_string(),
            model: "gpt-4.1".to_string(),
            temperature: 0.3,
            system_prompt: default_assistant_system_prompt(),
            local_base_url: "http://localhost:8080".to_string(),
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            tracking: TrackingConfig::default(),
            ai: AiConfig::default(),
            flow_guard: FlowGuardConfig::default(),
            ui: UiConfig::default(),
            cloud: CloudConfig::default(),
            assistant: AssistantConfig::default(),
        }
    }
}

fn default_assistant_system_prompt() -> String {
    r#"You are Chronos Assistant — an AI built into Chronos that helps users understand and act on their data.

## Identity
- You are part of the app, not an external service. Never say "I'm ChatGPT" or reference OpenAI.
- Speak as "I" — first person, embedded teammate.
- Language: match the user's language automatically. Default: en.

## Data Access
You receive structured context about the user's data in <app_context> tags with every message.
- Only reference data present in <app_context>. Never invent entries, dates, or statistics.
- If data is insufficient to answer, say exactly what's missing and suggest what the user could do.

## Capabilities
1. Query — answer questions about the user's data.
2. Analyze — spot patterns, trends, and anomalies.
3. Suggest — give practical recommendations based on the data.
4. Summarize — produce concise daily or weekly digests on demand.

## Response Format
- Lead with the answer. No preamble.
- Use numbers when you have them. Be specific.
- Keep responses under 150 words unless the user asks for detail.
- Use markdown sparingly: bold for emphasis, bullet lists for 3 or more items.
- Never use headers in short answers.

## Constraints
- Never expose raw IDs, internal schemas, or implementation details.
- Never suggest actions the app cannot perform.
- If asked about something outside your data scope, say so in one sentence.
- Privacy first: never reference data from other users or external sources."#
        .to_string()
}

impl AppConfig {
    fn config_path() -> PathBuf {
        let data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        data_dir.join("dev.chronos").join("config.json")
    }

    pub fn load_or_default() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(contents) = std::fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str(&contents) {
                    return config;
                }
            }
        }
        let config = Self::default();
        config.save().ok();
        config
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::AppConfig;

    #[test]
    fn default_cloud_sync_starts_disabled_and_empty() {
        let config = AppConfig::default();

        assert!(!config.cloud.enabled);
        assert_eq!(config.cloud.base_url, "");
        assert_eq!(config.cloud.sync_token, "");
        assert_eq!(config.cloud.last_sync_at, None);
    }

    #[test]
    fn old_config_without_cloud_section_still_deserializes() {
        let raw = r#"{
          "tracking": { "enabled": true, "dedup_threshold_seconds": 3, "poll_interval_ms": 1000 },
          "ai": {
            "ollama_url": "http://localhost:11434",
            "tier1_model": "qwen3.5:0.8b",
            "tier2_model": "qwen3.5:4b",
            "classify_timeout_ms": 5000,
            "min_confidence_threshold": 0.5
          },
          "flow_guard": {
            "enabled": true,
            "threshold_minutes": 20,
            "interrupt_apps": ["com.tinyspeck.slackmacgap"]
          },
          "ui": {
            "theme": "system",
            "show_in_tray": true,
            "show_current_activity_in_tray": true
          }
        }"#;

        let config = serde_json::from_str::<AppConfig>(raw).expect("old config deserializes");
        assert!(!config.cloud.enabled);
        assert_eq!(config.cloud.base_url, "");
        assert!(!config.assistant.enabled);
        assert_eq!(config.assistant.provider, "openai");
    }

    #[test]
    fn default_assistant_settings_match_embedded_chat_defaults() {
        let config = AppConfig::default();

        assert!(!config.assistant.enabled);
        assert_eq!(config.assistant.provider, "openai");
        assert_eq!(config.assistant.model, "gpt-4.1");
        assert_eq!(config.assistant.temperature, 0.3);
        assert_eq!(config.assistant.local_base_url, "http://localhost:8080");
        assert!(config
            .assistant
            .system_prompt
            .contains("You are Chronos Assistant"));
    }
}
