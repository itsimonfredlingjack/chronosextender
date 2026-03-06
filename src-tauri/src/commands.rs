use std::sync::Arc;

use tauri::{Emitter, Manager, State};

use crate::config::AppConfig;
use crate::daemon::DaemonState;
use crate::models::*;

type Result<T> = std::result::Result<T, String>;

#[tauri::command]
pub async fn get_today_events(state: State<'_, Arc<DaemonState>>) -> Result<Vec<Event>> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    state
        .db
        .get_events_for_date(&today)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_timeline(state: State<'_, Arc<DaemonState>>, date: String) -> Result<Vec<Event>> {
    state
        .db
        .get_events_for_date(&date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pending_events(state: State<'_, Arc<DaemonState>>) -> Result<Vec<Event>> {
    state.db.get_pending_events().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reclassify_event(
    app: tauri::AppHandle,
    state: State<'_, Arc<DaemonState>>,
    event_id: i64,
    project: Option<String>,
    category: String,
    task_description: Option<String>,
) -> Result<bool> {
    let result = ClassificationResult {
        project,
        category,
        task_description,
        confidence: 1.0,
        billable: false,
    };
    state
        .db
        .update_event_classification(event_id, &result, "manual")
        .map_err(|e| e.to_string())?;
    app.emit("events-changed", ()).ok();
    Ok(true)
}

#[tauri::command]
pub async fn get_projects(state: State<'_, Arc<DaemonState>>) -> Result<Vec<Project>> {
    state.db.get_all_projects().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_project(
    state: State<'_, Arc<DaemonState>>,
    project: NewProject,
) -> Result<i64> {
    state
        .db
        .upsert_project(&project)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_rules(state: State<'_, Arc<DaemonState>>) -> Result<Vec<Rule>> {
    state.db.get_rules_ordered().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_rule(state: State<'_, Arc<DaemonState>>, rule: NewRule) -> Result<i64> {
    state.db.insert_rule(&rule).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_rule(state: State<'_, Arc<DaemonState>>, id: i64) -> Result<bool> {
    state.db.delete_rule(id).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn get_rule_suggestions(
    state: State<'_, Arc<DaemonState>>,
) -> Result<Vec<RuleSuggestion>> {
    state
        .db
        .get_rule_suggestions()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_flow_status(state: State<'_, Arc<DaemonState>>) -> Result<FlowStatus> {
    let flow = state.flow_status.lock().await;
    Ok(flow.clone())
}

#[tauri::command]
pub async fn get_ollama_status(state: State<'_, Arc<DaemonState>>) -> Result<OllamaStatus> {
    let status = state.ollama_status.lock().await;
    Ok(status.clone())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, Arc<DaemonState>>) -> Result<AppConfig> {
    let config = state.config.lock().await;
    Ok(config.clone())
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, Arc<DaemonState>>,
    settings: AppConfig,
) -> Result<bool> {
    settings.save().map_err(|e| e.to_string())?;
    let mut config = state.config.lock().await;
    *config = settings;
    Ok(true)
}

#[tauri::command]
pub async fn get_project_summary(
    state: State<'_, Arc<DaemonState>>,
    start: String,
    end: String,
) -> Result<ProjectSummary> {
    let events = state
        .db
        .get_events_for_date_range(&start, &end)
        .map_err(|e| e.to_string())?;

    // Load projects for billable/rate info
    let db_projects = state
        .db
        .get_all_projects()
        .map_err(|e| e.to_string())?;
    let project_info: std::collections::HashMap<String, &Project> = db_projects
        .iter()
        .map(|p| (p.name.clone(), p))
        .collect();

    let mut project_map: std::collections::HashMap<String, (f64, Vec<(String, f64)>)> =
        std::collections::HashMap::new();
    let mut total_hours = 0.0;

    for event in &events {
        let hours = event.duration_seconds as f64 / 3600.0;
        total_hours += hours;
        let project_name = event
            .project
            .clone()
            .unwrap_or_else(|| "Unclassified".to_string());
        let category = event
            .category
            .clone()
            .unwrap_or_else(|| "unknown".to_string());

        let entry = project_map
            .entry(project_name)
            .or_insert_with(|| (0.0, vec![]));
        entry.0 += hours;
        entry.1.push((category, hours));
    }

    let mut billable_hours = 0.0;

    let projects = project_map
        .into_iter()
        .map(|(name, (hours, cats))| {
            let mut cat_map: std::collections::HashMap<String, f64> =
                std::collections::HashMap::new();
            for (cat, h) in cats {
                *cat_map.entry(cat).or_default() += h;
            }

            let is_billable = project_info
                .get(&name)
                .map(|p| p.is_billable)
                .unwrap_or(false);

            if is_billable {
                billable_hours += hours;
            }

            ProjectTimeEntry {
                project: name,
                hours,
                billable: is_billable,
                category_breakdown: cat_map
                    .into_iter()
                    .map(|(category, hours)| CategoryTime { category, hours })
                    .collect(),
            }
        })
        .collect();

    Ok(ProjectSummary {
        projects,
        total_hours,
        billable_hours,
    })
}

#[tauri::command]
pub async fn toggle_tracking(state: State<'_, Arc<DaemonState>>) -> Result<bool> {
    let mut paused = state.tracking_paused.lock().await;
    *paused = !*paused;
    Ok(!*paused) // returns true if tracking is now active
}

#[tauri::command]
pub async fn get_flow_sessions(
    state: State<'_, Arc<DaemonState>>,
    date: String,
) -> Result<Vec<FlowSession>> {
    state
        .db
        .get_flow_sessions_for_date(&date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn show_overlay(app: tauri::AppHandle) -> Result<()> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.center().map_err(|e| e.to_string())?;
        overlay.show().map_err(|e| e.to_string())?;
        overlay.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_overlay(app: tauri::AppHandle) -> Result<()> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn show_dashboard(app: tauri::AppHandle) -> Result<()> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.hide().ok();
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_pending_count(state: State<'_, Arc<DaemonState>>) -> Result<usize> {
    let pending = state.db.get_pending_events().map_err(|e| e.to_string())?;
    Ok(pending.len())
}

#[tauri::command]
pub async fn get_tracking_active(state: State<'_, Arc<DaemonState>>) -> Result<bool> {
    let paused = state.tracking_paused.lock().await;
    Ok(!*paused)
}

#[tauri::command]
pub async fn trigger_batch_reclassify(
    app: tauri::AppHandle,
    state: State<'_, Arc<DaemonState>>,
) -> Result<usize> {
    let count = crate::daemon::classifier::batch_reclassify(&state)
        .await
        .map_err(|e| e.to_string())?;
    app.emit("events-changed", ()).ok();
    Ok(count)
}

#[tauri::command]
pub async fn trigger_daily_summary(
    state: State<'_, Arc<DaemonState>>,
    date: String,
) -> Result<String> {
    crate::daemon::classifier::generate_daily_summary(&state, &date)
        .await
        .map_err(|e| e.to_string())
}
