use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: i64,
    pub start_time: String,
    pub end_time: Option<String>,
    pub app_bundle_id: String,
    pub app_name: String,
    pub window_title: Option<String>,
    pub browser_url: Option<String>,
    pub duration_seconds: i64,
    pub category: Option<String>,
    pub project: Option<String>,
    pub task_description: Option<String>,
    pub confidence: f64,
    pub classification_source: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEvent {
    pub start_time: String,
    pub app_bundle_id: String,
    pub app_name: String,
    pub window_title: Option<String>,
    pub browser_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub client: Option<String>,
    pub hourly_rate: Option<f64>,
    pub color: String,
    pub is_billable: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewProject {
    pub name: String,
    pub client: Option<String>,
    pub hourly_rate: Option<f64>,
    pub color: Option<String>,
    pub is_billable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: i64,
    pub priority: i64,
    pub match_type: String,
    pub match_value: String,
    pub target_category: Option<String>,
    pub target_project_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewRule {
    pub priority: Option<i64>,
    pub match_type: String,
    pub match_value: String,
    pub target_category: Option<String>,
    pub target_project_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Summary {
    pub id: i64,
    pub period_type: String,
    pub period_start: String,
    pub period_end: String,
    pub summary_json: String,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowSession {
    pub id: i64,
    pub start_time: String,
    pub end_time: String,
    pub primary_app: String,
    pub primary_project: Option<String>,
    pub duration_minutes: i64,
    pub interrupted: bool,
    pub interrupted_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationResult {
    pub project: Option<String>,
    pub category: String,
    pub task_description: Option<String>,
    pub confidence: f64,
    pub billable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FlowStatus {
    pub in_flow: bool,
    pub current_app: Option<String>,
    pub duration_minutes: u64,
    pub flow_start: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OllamaStatus {
    pub connected: bool,
    pub available_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CloudSyncStatus {
    pub enabled: bool,
    pub configured: bool,
    pub base_url: String,
    pub device_id: String,
    pub last_sync_at: Option<String>,
    pub issues: Vec<String>,
    pub has_local_activity: bool,
    pub local_event_days: usize,
    pub local_summary_days: usize,
    pub local_flow_days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CloudSyncReport {
    pub synced_dates: Vec<String>,
    pub uploaded_summaries: usize,
    pub uploaded_project_rollups: usize,
    pub uploaded_flow_sessions: usize,
    pub last_sync_at: Option<String>,
    pub failures: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub projects: Vec<ProjectTimeEntry>,
    pub total_hours: f64,
    pub billable_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTimeEntry {
    pub project: String,
    pub hours: f64,
    pub billable: bool,
    pub category_breakdown: Vec<CategoryTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryTime {
    pub category: String,
    pub hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSuggestion {
    pub app_name: String,
    pub suggested_category: String,
    pub event_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpLogResult {
    pub events_created: usize,
    pub entries: Vec<NlpParsedEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpParsedEntry {
    pub date: String,
    pub duration_minutes: i64,
    pub category: String,
    pub project: Option<String>,
    pub task_description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantHistoryMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantContextEvent {
    pub start_time: String,
    pub end_time: Option<String>,
    pub project: Option<String>,
    pub category: Option<String>,
    pub app_name: String,
    pub task_description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantRecentSummary {
    pub date: String,
    pub total_hours: f64,
    pub top_category: String,
    pub top_project: String,
    pub summary: String,
    pub productivity_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantProjectTotal {
    pub project: String,
    pub seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantContextSnapshot {
    pub current_date: String,
    pub today_total_seconds: i64,
    pub week_total_seconds: i64,
    pub today_event_count: usize,
    pub pending_count: usize,
    pub current_flow_minutes: u64,
    pub top_projects: Vec<AssistantProjectTotal>,
    pub recent_events: Vec<AssistantContextEvent>,
    pub recent_summaries: Vec<AssistantRecentSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantSecretStatus {
    pub provider: String,
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantStreamRequest {
    pub request_id: String,
    pub history: Vec<AssistantHistoryMessage>,
    pub context_xml: String,
    pub user_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantStreamEventPayload {
    pub request_id: String,
    pub event_type: String,
    pub delta: Option<String>,
    pub error: Option<String>,
}

pub const CATEGORIES: &[&str] = &[
    "coding",
    "communication",
    "design",
    "documentation",
    "browsing",
    "meeting",
    "admin",
    "entertainment",
    "unknown",
];
