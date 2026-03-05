use std::sync::Arc;
use std::time::Instant;

use chrono::Local;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use super::DaemonState;
use crate::models::FlowStatus;

pub struct FlowTracker {
    pub current_app: Option<String>,
    pub flow_start: Option<Instant>,
    pub in_flow: bool,
}

impl Default for FlowTracker {
    fn default() -> Self {
        Self {
            current_app: None,
            flow_start: None,
            in_flow: false,
        }
    }
}

// Shared flow tracker state
static FLOW_TRACKER: once_cell::sync::Lazy<Mutex<FlowTracker>> =
    once_cell::sync::Lazy::new(|| Mutex::new(FlowTracker::default()));

pub async fn on_window_change(
    app_handle: AppHandle,
    state: &Arc<DaemonState>,
    new_app_name: &str,
    new_bundle_id: &str,
) {
    let config = state.config.lock().await;
    let mut tracker = FLOW_TRACKER.lock().await;

    if tracker.in_flow {
        // Check if new app is an interrupt app
        let is_interrupt = config.flow_guard.interrupt_apps.iter().any(|app| {
            app.eq_ignore_ascii_case(new_bundle_id)
        });

        if is_interrupt && config.flow_guard.enabled {
            let duration = tracker
                .flow_start
                .map(|s| s.elapsed().as_secs() / 60)
                .unwrap_or(0);

            #[derive(Clone, serde::Serialize)]
            struct FlowGuardPayload {
                duration_minutes: u64,
                interrupted_by: String,
            }

            app_handle
                .emit(
                    "flow-guard-trigger",
                    FlowGuardPayload {
                        duration_minutes: duration,
                        interrupted_by: new_app_name.to_string(),
                    },
                )
                .ok();

            log::info!(
                "Flow Guard triggered! {} min of flow interrupted by {}",
                duration,
                new_app_name
            );
        }

        // Record flow session
        if let Some(start) = tracker.flow_start {
            let duration_min = start.elapsed().as_secs() / 60;
            if duration_min > 0 {
                let start_time = Local::now()
                    .checked_sub_signed(chrono::Duration::seconds(start.elapsed().as_secs() as i64))
                    .unwrap_or_else(Local::now)
                    .format("%Y-%m-%dT%H:%M:%S")
                    .to_string();
                let end_time = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

                state
                    .db
                    .insert_flow_session(
                        &start_time,
                        &end_time,
                        tracker.current_app.as_deref().unwrap_or("unknown"),
                        None,
                        duration_min as i64,
                        true,
                        Some(new_app_name),
                    )
                    .ok();
            }
        }

        tracker.in_flow = false;
        app_handle.emit("flow-state-changed", false).ok();
    }

    // Reset tracking to new app
    tracker.current_app = Some(new_app_name.to_string());
    tracker.flow_start = Some(Instant::now());

    // Update shared flow status
    let mut flow_status = state.flow_status.lock().await;
    *flow_status = FlowStatus {
        in_flow: false,
        current_app: Some(new_app_name.to_string()),
        duration_minutes: 0,
        flow_start: Some(Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()),
    };
}

/// Background task that monitors if current session reaches flow threshold
pub async fn flow_monitor(app_handle: AppHandle, state: Arc<DaemonState>) {
    loop {
        {
            let config = state.config.lock().await;
            let threshold = config.flow_guard.threshold_minutes;
            drop(config);

            let mut tracker = FLOW_TRACKER.lock().await;
            if let Some(start) = tracker.flow_start {
                let elapsed_min = start.elapsed().as_secs() / 60;

                if elapsed_min >= threshold && !tracker.in_flow {
                    tracker.in_flow = true;
                    log::info!(
                        "Flow state entered! {} in {} for {} min",
                        tracker.current_app.as_deref().unwrap_or("unknown"),
                        tracker.current_app.as_deref().unwrap_or("unknown"),
                        elapsed_min
                    );

                    app_handle.emit("flow-state-changed", true).ok();
                }

                // Update shared status
                let mut flow_status = state.flow_status.lock().await;
                flow_status.in_flow = tracker.in_flow;
                flow_status.duration_minutes = elapsed_min;
                flow_status.current_app = tracker.current_app.clone();
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
    }
}
