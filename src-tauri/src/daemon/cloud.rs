use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use std::collections::BTreeSet;

use chrono::{Duration, Local};
use reqwest::StatusCode;

use super::DaemonState;
use crate::config::AppConfig;
use crate::models::{CloudSyncReport, CloudSyncStatus};
use crate::models::{Event, FlowSession, Project, Summary};

const OWNER_ACCOUNT_ID: &str = "owner";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudDaySummaryPayload {
    pub account_id: String,
    pub device_id: String,
    pub date: String,
    pub total_hours: f64,
    pub top_category: String,
    pub top_project: String,
    pub summary: String,
    pub productivity_score: f64,
    pub event_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudProjectRollupPayload {
    pub account_id: String,
    pub device_id: String,
    pub date: String,
    pub project: String,
    pub client: Option<String>,
    pub color: String,
    pub billable: bool,
    pub hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudFlowSessionPayload {
    pub account_id: String,
    pub device_id: String,
    pub date: String,
    pub primary_app: String,
    pub primary_project: Option<String>,
    pub duration_minutes: i64,
    pub interrupted: bool,
    pub interrupted_by: Option<String>,
    pub started_at: String,
    pub ended_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ParsedDailySummary {
    pub total_hours: f64,
    pub top_category: String,
    pub top_project: String,
    pub summary: String,
    pub productivity_score: f64,
}

pub fn default_device_id() -> String {
    format!("chronos-desktop-{}", std::env::consts::OS)
}

pub fn cloud_sync_status(config: &AppConfig) -> CloudSyncStatus {
    CloudSyncStatus {
        enabled: config.cloud.enabled,
        configured: !config.cloud.base_url.trim().is_empty()
            && !config.cloud.sync_token.trim().is_empty(),
        base_url: config.cloud.base_url.clone(),
        device_id: default_device_id(),
        last_sync_at: config.cloud.last_sync_at.clone(),
        issues: Vec::new(),
        has_local_activity: false,
        local_event_days: 0,
        local_summary_days: 0,
        local_flow_days: 0,
    }
}

pub fn enrich_cloud_sync_status(
    mut status: CloudSyncStatus,
    local_event_days: usize,
    local_summary_days: usize,
    local_flow_days: usize,
) -> CloudSyncStatus {
    let mut issues = Vec::new();
    let trimmed_base_url = status.base_url.trim();

    if !status.enabled {
        issues.push("Hosted ChatGPT sync is turned off in Settings.".to_string());
    }

    if trimmed_base_url.is_empty() {
        issues.push("Hosted Base URL is missing.".to_string());
    } else if trimmed_base_url.trim_end_matches('/').ends_with("/mcp") {
        issues.push(
            "Hosted Base URL should be the worker origin without /mcp. ChatGPT uses /mcp, desktop sync does not."
                .to_string(),
        );
    }

    if !status.configured {
        issues.push("Add both Hosted Base URL and Owner Sync Token before syncing.".to_string());
    }

    let has_local_activity = local_event_days > 0 || local_flow_days > 0;
    if has_local_activity && status.last_sync_at.is_none() {
        issues.push(
            "Local activity exists, but nothing has been synced to the hosted ChatGPT layer yet."
                .to_string(),
        );
    }

    if local_summary_days == 0 {
        issues.push(
            "No local daily summaries exist yet, so recent summary cards will stay empty until a daily summary is generated."
                .to_string(),
        );
    }

    status.issues = issues;
    status.has_local_activity = has_local_activity;
    status.local_event_days = local_event_days;
    status.local_summary_days = local_summary_days;
    status.local_flow_days = local_flow_days;
    status
}

pub fn build_day_summary_payload(
    account_id: &str,
    device_id: &str,
    date: &str,
    summary: &Summary,
    events: &[Event],
) -> Option<CloudDaySummaryPayload> {
    let parsed = serde_json::from_str::<ParsedDailySummary>(&summary.summary_json).ok()?;

    Some(CloudDaySummaryPayload {
        account_id: account_id.to_string(),
        device_id: device_id.to_string(),
        date: date.to_string(),
        total_hours: parsed.total_hours,
        top_category: parsed.top_category,
        top_project: parsed.top_project,
        summary: parsed.summary,
        productivity_score: parsed.productivity_score,
        event_count: events.len(),
    })
}

pub fn build_project_rollup_payloads(
    account_id: &str,
    device_id: &str,
    date: &str,
    events: &[Event],
    projects: &[Project],
) -> Vec<CloudProjectRollupPayload> {
    let project_meta = projects
        .iter()
        .map(|project| (project.name.clone(), project))
        .collect::<HashMap<_, _>>();
    let mut totals = HashMap::<String, f64>::new();

    for event in events {
        let project = event
            .project
            .clone()
            .unwrap_or_else(|| "Unclassified".to_string());
        *totals.entry(project).or_default() += event.duration_seconds as f64 / 3600.0;
    }

    let mut payloads = totals
        .into_iter()
        .map(|(project, hours)| {
            let meta = project_meta.get(&project);
            CloudProjectRollupPayload {
                account_id: account_id.to_string(),
                device_id: device_id.to_string(),
                date: date.to_string(),
                project: project.clone(),
                client: meta.and_then(|project| project.client.clone()),
                color: meta
                    .map(|project| project.color.clone())
                    .unwrap_or_else(|| "#6366f1".to_string()),
                billable: meta.map(|project| project.is_billable).unwrap_or(false),
                hours,
            }
        })
        .collect::<Vec<_>>();

    payloads.sort_by(|left, right| right.hours.total_cmp(&left.hours));
    payloads
}

pub fn build_flow_session_payloads(
    account_id: &str,
    device_id: &str,
    date: &str,
    sessions: &[FlowSession],
) -> Vec<CloudFlowSessionPayload> {
    sessions
        .iter()
        .map(|session| CloudFlowSessionPayload {
            account_id: account_id.to_string(),
            device_id: device_id.to_string(),
            date: date.to_string(),
            primary_app: session.primary_app.clone(),
            primary_project: session.primary_project.clone(),
            duration_minutes: session.duration_minutes,
            interrupted: session.interrupted,
            interrupted_by: session.interrupted_by.clone(),
            started_at: session.start_time.clone(),
            ended_at: session.end_time.clone(),
        })
        .collect()
}

pub fn collect_sync_dates(
    today: &str,
    last_sync_at: Option<&str>,
    summary_dates: &[String],
    flow_dates: &[String],
) -> Vec<String> {
    let threshold = last_sync_at.and_then(|value| value.get(0..10));
    let mut dates = BTreeSet::new();

    for date in summary_dates.iter().chain(flow_dates.iter()) {
        if threshold
            .map(|threshold| date.as_str() >= threshold)
            .unwrap_or(true)
        {
            dates.insert(date.clone());
        }
    }

    dates.insert(today.to_string());
    dates.into_iter().collect()
}

pub fn collect_full_sync_dates(
    today: &str,
    activity_dates: &[String],
    flow_dates: &[String],
) -> Vec<String> {
    let mut dates = BTreeSet::new();

    for date in activity_dates.iter().chain(flow_dates.iter()) {
        dates.insert(date.clone());
    }

    dates.insert(today.to_string());
    dates.into_iter().collect()
}

pub async fn sync_recent_aggregates(
    state: &Arc<DaemonState>,
    days_back: usize,
) -> Result<CloudSyncReport, String> {
    let config = state.config.lock().await.clone();
    let today = Local::now().date_naive();
    let dates = if let Some(last_sync_at) = config.cloud.last_sync_at.as_deref() {
        let mut summary_dates = state
            .db
            .get_summary_dates_since(last_sync_at.get(0..10))
            .map_err(|e| e.to_string())?;
        let event_dates = state
            .db
            .get_event_dates_since(last_sync_at.get(0..10))
            .map_err(|e| e.to_string())?;
        let flow_dates = state
            .db
            .get_flow_session_dates_since(last_sync_at.get(0..10))
            .map_err(|e| e.to_string())?;
        summary_dates.extend(event_dates);

        collect_sync_dates(
            &today.format("%Y-%m-%d").to_string(),
            Some(last_sync_at),
            &summary_dates,
            &flow_dates,
        )
    } else {
        (0..days_back.max(1))
            .map(|offset| {
                (today - Duration::days(offset as i64))
                    .format("%Y-%m-%d")
                    .to_string()
            })
            .collect::<Vec<_>>()
    };
    sync_dates(state, &dates).await
}

pub async fn sync_all_aggregates(state: &Arc<DaemonState>) -> Result<CloudSyncReport, String> {
    let today = Local::now().date_naive();
    let mut activity_dates = state
        .db
        .get_summary_dates_since(None)
        .map_err(|e| e.to_string())?;
    let event_dates = state
        .db
        .get_event_dates_since(None)
        .map_err(|e| e.to_string())?;
    let flow_dates = state
        .db
        .get_flow_session_dates_since(None)
        .map_err(|e| e.to_string())?;

    activity_dates.extend(event_dates);

    let dates = collect_full_sync_dates(
        &today.format("%Y-%m-%d").to_string(),
        &activity_dates,
        &flow_dates,
    );
    sync_dates(state, &dates).await
}

pub async fn sync_dates(
    state: &Arc<DaemonState>,
    dates: &[String],
) -> Result<CloudSyncReport, String> {
    let config = state.config.lock().await.clone();
    let status = cloud_sync_status(&config);
    if !status.enabled {
        return Err("Cloud sync is disabled".to_string());
    }
    if !status.configured {
        return Err("Cloud sync is not fully configured".to_string());
    }

    let client = reqwest::Client::new();
    let projects = state.db.get_all_projects().map_err(|e| e.to_string())?;
    let base_url = config.cloud.base_url.trim_end_matches('/').to_string();
    let mut report = CloudSyncReport::default();
    let device_id = status.device_id;

    for date in dates {
        let events = state
            .db
            .get_events_for_date(date)
            .map_err(|e| e.to_string())?;
        let summary = state
            .db
            .get_daily_summary(date)
            .map_err(|e| e.to_string())?;
        let flow_sessions = state
            .db
            .get_flow_sessions_for_date(date)
            .map_err(|e| e.to_string())?;

        if events.is_empty() && summary.is_none() && flow_sessions.is_empty() {
            continue;
        }

        let mut date_failed = false;

        if let Some(summary) = summary.and_then(|record| {
            build_day_summary_payload(OWNER_ACCOUNT_ID, &device_id, date, &record, &events)
        }) {
            if let Err(error) = post_json(
                &client,
                &base_url,
                &config.cloud.sync_token,
                "/sync/daily-summary",
                &summary,
            )
            .await
            {
                date_failed = true;
                report.failures.push(format!("{date}: {error}"));
            } else {
                report.uploaded_summaries += 1;
            }
        }

        let project_rollups =
            build_project_rollup_payloads(OWNER_ACCOUNT_ID, &device_id, date, &events, &projects);
        if !project_rollups.is_empty() {
            if let Err(error) = post_json(
                &client,
                &base_url,
                &config.cloud.sync_token,
                "/sync/project-rollups",
                &project_rollups,
            )
            .await
            {
                date_failed = true;
                report.failures.push(format!("{date}: {error}"));
            } else {
                report.uploaded_project_rollups += project_rollups.len();
            }
        }

        let flow_payloads =
            build_flow_session_payloads(OWNER_ACCOUNT_ID, &device_id, date, &flow_sessions);
        if !flow_payloads.is_empty() {
            if let Err(error) = post_json(
                &client,
                &base_url,
                &config.cloud.sync_token,
                "/sync/flow-sessions",
                &flow_payloads,
            )
            .await
            {
                date_failed = true;
                report.failures.push(format!("{date}: {error}"));
            } else {
                report.uploaded_flow_sessions += flow_payloads.len();
            }
        }

        if !date_failed {
            report.synced_dates.push(date.clone());
        }
    }

    if report.synced_dates.is_empty() && !report.failures.is_empty() {
        return Err(format!(
            "Cloud sync failed for {} date(s)",
            report.failures.len()
        ));
    }

    if !report.synced_dates.is_empty() {
        let now = Local::now().to_rfc3339();
        report.last_sync_at = Some(now.clone());

        let mut updated = state.config.lock().await;
        updated.cloud.last_sync_at = Some(now);
        updated.save().map_err(|e| e.to_string())?;
    }

    Ok(report)
}

async fn post_json<T: Serialize>(
    client: &reqwest::Client,
    base_url: &str,
    sync_token: &str,
    path: &str,
    payload: &T,
) -> Result<(), String> {
    let response = client
        .post(format!("{base_url}{path}"))
        .bearer_auth(sync_token)
        .json(payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status() == StatusCode::OK || response.status() == StatusCode::CREATED {
        return Ok(());
    }

    Err(format!("{} returned {}", path, response.status()))
}

#[cfg(test)]
mod tests {
    use super::{
        build_day_summary_payload, build_flow_session_payloads, build_project_rollup_payloads,
        cloud_sync_status, collect_full_sync_dates, collect_sync_dates, enrich_cloud_sync_status,
    };
    use crate::config::{AppConfig, CloudConfig};
    use crate::models::{Event, FlowSession, Project, Summary};

    fn sample_event(project: Option<&str>, category: Option<&str>, duration_seconds: i64) -> Event {
        Event {
            id: 1,
            start_time: "2026-03-06T09:00:00".to_string(),
            end_time: Some("2026-03-06T10:00:00".to_string()),
            app_bundle_id: "dev.test.app".to_string(),
            app_name: "Test App".to_string(),
            window_title: Some("Super Secret Window Title".to_string()),
            browser_url: Some("https://secret.example.com/path".to_string()),
            duration_seconds,
            category: category.map(str::to_string),
            project: project.map(str::to_string),
            task_description: Some("Should not leave desktop".to_string()),
            confidence: 0.9,
            classification_source: "llm".to_string(),
            timesheet_status: Some("approved".to_string()),
            approved_at: Some("2026-03-06T18:00:00".to_string()),
            created_at: "2026-03-06T09:00:00".to_string(),
        }
    }

    #[test]
    fn day_summary_payload_uses_summary_json_and_counts_events() {
        let summary = Summary {
            id: 1,
            period_type: "daily".to_string(),
            period_start: "2026-03-06".to_string(),
            period_end: "2026-03-06".to_string(),
            summary_json: r#"{
                "total_hours": 5.5,
                "top_category": "coding",
                "top_project": "Chronos",
                "summary": "Strong day of focused work.",
                "productivity_score": 8.4
            }"#
            .to_string(),
            generated_at: "2026-03-06T18:00:00".to_string(),
        };
        let payload = build_day_summary_payload(
            "owner",
            "chronos-desktop",
            "2026-03-06",
            &summary,
            &[sample_event(Some("Chronos"), Some("coding"), 3600)],
        )
        .expect("payload");

        assert_eq!(payload.account_id, "owner");
        assert_eq!(payload.device_id, "chronos-desktop");
        assert_eq!(payload.event_count, 1);
        assert_eq!(payload.total_hours, 5.5);
        assert_eq!(payload.summary, "Strong day of focused work.");
    }

    #[test]
    fn project_rollup_payloads_stay_aggregate_only() {
        let projects = vec![
            Project {
                id: 1,
                name: "Chronos".to_string(),
                client: Some("CoffeeDev".to_string()),
                hourly_rate: Some(1500.0),
                color: "#111bf5".to_string(),
                is_billable: true,
                created_at: "2026-03-06T09:00:00".to_string(),
            },
            Project {
                id: 2,
                name: "Internal".to_string(),
                client: None,
                hourly_rate: None,
                color: "#22c55e".to_string(),
                is_billable: false,
                created_at: "2026-03-06T09:00:00".to_string(),
            },
        ];
        let payloads = build_project_rollup_payloads(
            "owner",
            "chronos-desktop",
            "2026-03-06",
            &[
                sample_event(Some("Chronos"), Some("coding"), 7200),
                sample_event(Some("Internal"), Some("admin"), 1800),
            ],
            &projects,
        );

        assert_eq!(payloads.len(), 2);
        let serialized = serde_json::to_string(&payloads).expect("serialize rollups");
        assert!(serialized.contains("\"project\":\"Chronos\""));
        assert!(serialized.contains("\"hours\":2.0"));
        assert!(!serialized.contains("Super Secret Window Title"));
        assert!(!serialized.contains("https://secret.example.com/path"));
        assert!(!serialized.contains("Should not leave desktop"));
    }

    #[test]
    fn flow_session_payloads_keep_timing_but_drop_unneeded_event_context() {
        let payloads = build_flow_session_payloads(
            "owner",
            "chronos-desktop",
            "2026-03-06",
            &[FlowSession {
                id: 1,
                start_time: "2026-03-06T09:00:00".to_string(),
                end_time: "2026-03-06T10:15:00".to_string(),
                primary_app: "Visual Studio Code".to_string(),
                primary_project: Some("Chronos".to_string()),
                duration_minutes: 75,
                interrupted: true,
                interrupted_by: Some("Slack".to_string()),
            }],
        );

        assert_eq!(payloads.len(), 1);
        assert_eq!(payloads[0].duration_minutes, 75);
        assert_eq!(payloads[0].primary_app, "Visual Studio Code");
        assert_eq!(payloads[0].interrupted_by.as_deref(), Some("Slack"));
    }

    #[test]
    fn collect_sync_dates_rolls_forward_from_last_sync_and_keeps_today() {
        let dates = collect_sync_dates(
            "2026-03-06",
            Some("2026-03-05T12:00:00Z"),
            &["2026-03-04".to_string(), "2026-03-05".to_string()],
            &["2026-03-05".to_string()],
        );

        assert_eq!(
            dates,
            vec!["2026-03-05".to_string(), "2026-03-06".to_string()]
        );
    }

    #[test]
    fn cloud_sync_status_surfaces_missing_setup_and_empty_summary_clues() {
        let config = AppConfig {
            cloud: CloudConfig {
                enabled: false,
                base_url: "https://chronos.example.com/mcp".to_string(),
                sync_token: String::new(),
                last_sync_at: None,
            },
            ..AppConfig::default()
        };

        let status = enrich_cloud_sync_status(cloud_sync_status(&config), 4, 0, 2);

        assert!(status.has_local_activity);
        assert_eq!(status.local_event_days, 4);
        assert_eq!(status.local_summary_days, 0);
        assert!(status
            .issues
            .iter()
            .any(|issue| issue.contains("without /mcp")));
        assert!(status
            .issues
            .iter()
            .any(|issue| issue.contains("nothing has been synced")));
        assert!(status
            .issues
            .iter()
            .any(|issue| issue.contains("No local daily summaries")));
    }

    #[test]
    fn collect_full_sync_dates_backfills_every_local_day_and_keeps_today() {
        let dates = collect_full_sync_dates(
            "2026-03-08",
            &[
                "2026-03-05".to_string(),
                "2026-03-07".to_string(),
                "2026-03-05".to_string(),
            ],
            &["2026-03-06".to_string(), "2026-03-07".to_string()],
        );

        assert_eq!(
            dates,
            vec![
                "2026-03-05".to_string(),
                "2026-03-06".to_string(),
                "2026-03-07".to_string(),
                "2026-03-08".to_string(),
            ]
        );
    }
}
