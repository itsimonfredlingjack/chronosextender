mod commands;
mod config;
mod daemon;
mod db;
mod models;

use std::sync::Arc;

use daemon::DaemonState;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tokio::sync::Mutex;

use config::AppConfig;
use db::Database;
use models::{FlowStatus, OllamaStatus};

fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        if overlay.is_visible().unwrap_or(false) {
            overlay.hide().ok();
        } else {
            overlay.center().ok();
            overlay.show().ok();
            overlay.set_focus().ok();
        }
    }
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let dashboard = MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause Tracking", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Chronos", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&dashboard, &pause, &separator, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Chronos AI - Tracking")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_overlay(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "dashboard" => {
                if let Some(overlay) = app.get_webview_window("overlay") {
                    overlay.hide().ok();
                }
                if let Some(window) = app.get_webview_window("main") {
                    window.show().ok();
                    window.set_focus().ok();
                }
            }
            "pause" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<Arc<DaemonState>>();
                    let mut paused = state.tracking_paused.lock().await;
                    *paused = !*paused;
                    log::info!("Tracking {}", if *paused { "paused" } else { "resumed" });
                });
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_secs()
        .init();

    let database = Arc::new(Database::new().expect("Failed to initialize database"));
    database.init_tables().expect("Failed to create tables");
    log::info!("Database initialized");

    let config = Arc::new(Mutex::new(AppConfig::load_or_default()));
    log::info!("Config loaded");

    let daemon_state = Arc::new(DaemonState {
        db: database,
        config,
        flow_status: Arc::new(Mutex::new(FlowStatus::default())),
        ollama_status: Arc::new(Mutex::new(OllamaStatus::default())),
        tracking_paused: Arc::new(Mutex::new(false)),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_overlay(app);
                    }
                })
                .build(),
        )
        .manage(daemon_state.clone())
        .invoke_handler(tauri::generate_handler![
            commands::get_today_events,
            commands::get_timeline,
            commands::get_pending_events,
            commands::reclassify_event,
            commands::get_projects,
            commands::upsert_project,
            commands::get_rules,
            commands::add_rule,
            commands::delete_rule,
            commands::get_rule_suggestions,
            commands::get_flow_status,
            commands::get_ollama_status,
            commands::get_settings,
            commands::update_settings,
            commands::get_project_summary,
            commands::toggle_tracking,
            commands::get_flow_sessions,
            commands::show_overlay,
            commands::hide_overlay,
            commands::show_dashboard,
            commands::get_pending_count,
            commands::get_tracking_active,
        ])
        .on_window_event(|window, event| {
            // Close button hides main window to tray instead of quitting
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    window.hide().ok();
                }
            }
        })
        .setup(move |app| {
            setup_tray(app)?;

            // Register Cmd+Shift+T global shortcut
            let shortcut =
                Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT);
            app.global_shortcut().register(shortcut)?;

            let handle = app.handle().clone();
            let state = daemon_state.clone();
            tauri::async_runtime::spawn(async move {
                daemon::start_daemon(handle, state).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
