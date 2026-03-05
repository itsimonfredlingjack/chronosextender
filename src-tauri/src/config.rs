use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub tracking: TrackingConfig,
    pub ai: AiConfig,
    pub flow_guard: FlowGuardConfig,
    pub ui: UiConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingConfig {
    pub enabled: bool,
    pub dedup_threshold_seconds: u64,
    pub poll_interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub ollama_url: String,
    pub tier1_model: String,
    pub tier2_model: String,
    pub classify_timeout_ms: u64,
    pub min_confidence_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowGuardConfig {
    pub enabled: bool,
    pub threshold_minutes: u64,
    pub interrupt_apps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    pub theme: String,
    pub show_in_tray: bool,
    pub show_current_activity_in_tray: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            tracking: TrackingConfig {
                enabled: true,
                dedup_threshold_seconds: 3,
                poll_interval_ms: 1000,
            },
            ai: AiConfig {
                ollama_url: "http://localhost:11434".to_string(),
                tier1_model: "qwen3.5:0.8b".to_string(),
                tier2_model: "qwen3.5:4b".to_string(),
                classify_timeout_ms: 5000,
                min_confidence_threshold: 0.5,
            },
            flow_guard: FlowGuardConfig {
                enabled: true,
                threshold_minutes: 20,
                interrupt_apps: vec![
                    "com.tinyspeck.slackmacgap".to_string(),
                    "com.apple.MobileSMS".to_string(),
                    "com.apple.mail".to_string(),
                    "com.hnc.Discord".to_string(),
                ],
            },
            ui: UiConfig {
                theme: "system".to_string(),
                show_in_tray: true,
                show_current_activity_in_tray: true,
            },
        }
    }
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
