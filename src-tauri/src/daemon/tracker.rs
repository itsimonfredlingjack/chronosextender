use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use active_win_pos_rs::get_active_window;
use chrono::Local;
use tauri::{AppHandle, Emitter};

use super::DaemonState;
use crate::models::NewEvent;

struct TrackerState {
    last_app_name: Option<String>,
    last_window_title: Option<String>,
    current_event_id: Option<i64>,
    event_start: Option<Instant>,
    last_change: Instant,
    bundle_id_cache: HashMap<String, String>,
}

pub async fn run(app_handle: AppHandle, state: Arc<DaemonState>) {
    let mut tracker = TrackerState {
        last_app_name: None,
        last_window_title: None,
        current_event_id: None,
        event_start: None,
        last_change: Instant::now(),
        bundle_id_cache: HashMap::new(),
    };

    let poll_interval = {
        let config = state.config.lock().await;
        config.tracking.poll_interval_ms
    };

    loop {
        // Check if tracking is paused
        if *state.tracking_paused.lock().await {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            continue;
        }

        // Check if tracking is enabled
        let enabled = {
            let config = state.config.lock().await;
            config.tracking.enabled
        };
        if !enabled {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            continue;
        }

        match get_active_window() {
            Ok(window) => {
                let app_name = window.app_name.clone();
                let window_title = window.title.clone();
                let process_path = window.process_path.to_string_lossy().to_string();

                let changed = tracker.last_app_name.as_deref() != Some(&app_name)
                    || tracker.last_window_title.as_deref() != Some(&window_title);

                if changed {
                    let now = Instant::now();
                    let elapsed = now.duration_since(tracker.last_change);

                    // Dedup: ignore switches shorter than threshold
                    let dedup_threshold = {
                        let config = state.config.lock().await;
                        config.tracking.dedup_threshold_seconds
                    };

                    if elapsed.as_secs() < dedup_threshold
                        && tracker.current_event_id.is_some()
                    {
                        // Too quick, skip this change
                        tokio::time::sleep(std::time::Duration::from_millis(poll_interval)).await;
                        continue;
                    }

                    // Close previous event
                    if let Some(prev_id) = tracker.current_event_id {
                        let end_time = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
                        let duration = tracker
                            .event_start
                            .map(|s| s.elapsed().as_secs() as i64)
                            .unwrap_or(0);
                        if let Err(e) = state.db.close_event(prev_id, &end_time, duration) {
                            log::error!("Failed to close event {}: {}", prev_id, e);
                        }
                    }

                    // Derive bundle_id
                    let bundle_id = get_bundle_id(&process_path, &mut tracker.bundle_id_cache);

                    // Create new event
                    let start_time = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
                    let new_event = NewEvent {
                        start_time,
                        app_bundle_id: bundle_id.clone(),
                        app_name: app_name.clone(),
                        window_title: Some(window_title.clone()),
                        browser_url: None,
                    };

                    match state.db.insert_event(&new_event) {
                        Ok(event_id) => {
                            tracker.current_event_id = Some(event_id);
                            tracker.event_start = Some(now);

                            // Trigger async classification
                            let classify_state = state.clone();
                            let classify_app = app_name.clone();
                            let classify_title = window_title.clone();
                            let classify_bundle = bundle_id;
                            tokio::spawn(async move {
                                super::classifier::classify_event(
                                    &classify_state,
                                    event_id,
                                    &classify_app,
                                    &classify_title,
                                    &classify_bundle,
                                    None,
                                )
                                .await;
                            });

                            // Notify flow detector
                            let flow_state = state.clone();
                            let flow_app = app_name.clone();
                            let flow_bundle = new_event.app_bundle_id.clone();
                            let flow_handle = app_handle.clone();
                            tokio::spawn(async move {
                                super::flow::on_window_change(
                                    flow_handle,
                                    &flow_state,
                                    &flow_app,
                                    &flow_bundle,
                                )
                                .await;
                            });

                            log::info!(
                                "New event: {} - {} (id: {})",
                                app_name, window_title, event_id
                            );

                            app_handle.emit("window-changed", serde_json::json!({
                                "event_id": event_id,
                                "app_name": &app_name,
                                "window_title": &window_title,
                            })).ok();
                        }
                        Err(e) => {
                            log::error!("Failed to insert event: {}", e);
                        }
                    }

                    tracker.last_app_name = Some(app_name);
                    tracker.last_window_title = Some(window_title);
                    tracker.last_change = now;
                } else {
                    // Same window — update duration
                    if let (Some(id), Some(start)) =
                        (tracker.current_event_id, tracker.event_start)
                    {
                        let duration = start.elapsed().as_secs() as i64;
                        state.db.update_event_duration(id, duration).ok();
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to get active window: {:?}", e);
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(poll_interval)).await;
    }
}

fn get_bundle_id(process_path: &str, cache: &mut HashMap<String, String>) -> String {
    if let Some(cached) = cache.get(process_path) {
        return cached.clone();
    }

    let bundle_id = derive_bundle_id(process_path).unwrap_or_else(|| "unknown".to_string());
    cache.insert(process_path.to_string(), bundle_id.clone());
    bundle_id
}

fn derive_bundle_id(process_path: &str) -> Option<String> {
    // Walk up from process path to find .app bundle
    let mut path = std::path::Path::new(process_path);
    while let Some(parent) = path.parent() {
        if path.extension().and_then(|e| e.to_str()) == Some("app") {
            // Found the .app bundle, read Info.plist
            let plist_path = path.join("Contents").join("Info.plist");
            if plist_path.exists() {
                if let Ok(value) = plist::Value::from_file(&plist_path) {
                    if let Some(dict) = value.as_dictionary() {
                        if let Some(id) = dict.get("CFBundleIdentifier") {
                            return id.as_string().map(|s| s.to_string());
                        }
                    }
                }
            }
            break;
        }
        path = parent;
    }
    None
}
