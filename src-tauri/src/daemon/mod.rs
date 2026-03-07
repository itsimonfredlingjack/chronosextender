pub mod classifier;
pub mod cloud;
pub mod flow;
pub mod health;
pub mod tracker;
pub mod websocket;

use std::collections::HashMap;
use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;

use crate::config::AppConfig;
use crate::db::Database;
use crate::models::{FlowStatus, OllamaStatus};

pub struct DaemonState {
    pub db: Arc<Database>,
    pub config: Arc<Mutex<AppConfig>>,
    pub flow_status: Arc<Mutex<FlowStatus>>,
    pub ollama_status: Arc<Mutex<OllamaStatus>>,
    pub tracking_paused: Arc<Mutex<bool>>,
    pub assistant_streams: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

pub async fn start_daemon(app_handle: AppHandle, state: Arc<DaemonState>) {
    log::info!("Starting Chronos daemon...");

    let tracker_state = state.clone();
    let tracker_handle = app_handle.clone();
    tokio::spawn(async move {
        tracker::run(tracker_handle, tracker_state).await;
    });

    let health_state = state.clone();
    let health_handle = app_handle.clone();
    tokio::spawn(async move {
        health::monitor(health_handle, health_state).await;
    });

    let flow_state = state.clone();
    let flow_handle = app_handle.clone();
    tokio::spawn(async move {
        flow::flow_monitor(flow_handle, flow_state).await;
    });

    let ws_state = state.clone();
    tokio::spawn(async move {
        websocket::serve(ws_state).await;
    });

    log::info!("All daemon tasks spawned");
}
