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
