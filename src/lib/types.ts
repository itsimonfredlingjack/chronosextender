import type {
  AssistantContextSnapshot,
  AssistantSecretStatus,
  AssistantSettings,
} from "../types/ai-types";

export interface Event {
  id: number;
  start_time: string;
  end_time: string | null;
  app_bundle_id: string;
  app_name: string;
  window_title: string | null;
  browser_url: string | null;
  duration_seconds: number;
  category: Category | null;
  project: string | null;
  task_description: string | null;
  confidence: number;
  classification_source: "pending" | "llm" | "rule" | "manual";
  timesheet_status?: TimesheetStatus | null;
  approved_at?: string | null;
  created_at: string;
}

export type TimesheetStatus =
  | "suggested"
  | "needs_review"
  | "approved"
  | "excluded";

export type Category =
  | "coding"
  | "communication"
  | "design"
  | "documentation"
  | "browsing"
  | "meeting"
  | "admin"
  | "entertainment"
  | "unknown";

export interface Project {
  id: number;
  name: string;
  client: string | null;
  hourly_rate: number | null;
  color: string;
  is_billable: boolean;
  created_at: string;
}

export interface NewProject {
  name: string;
  client: string | null;
  hourly_rate: number | null;
  color: string | null;
  is_billable: boolean;
}

export interface Rule {
  id: number;
  priority: number;
  match_type: string;
  match_value: string;
  target_category: string | null;
  target_project_id: number | null;
  created_at: string;
}

export interface NewRule {
  priority: number | null;
  match_type: string;
  match_value: string;
  target_category: string | null;
  target_project_id: number | null;
}

export interface FlowStatus {
  in_flow: boolean;
  current_app: string | null;
  duration_minutes: number;
  flow_start: string | null;
}

export interface FlowSession {
  id: number;
  start_time: string;
  end_time: string;
  primary_app: string;
  primary_project: string | null;
  duration_minutes: number;
  interrupted: boolean;
  interrupted_by: string | null;
}

export interface OllamaStatus {
  connected: boolean;
  available_models: string[];
}

export interface ProjectSummary {
  projects: ProjectTimeEntry[];
  total_hours: number;
  billable_hours: number;
}

export interface ProjectTimeEntry {
  project: string;
  hours: number;
  billable: boolean;
  category_breakdown: CategoryTime[];
}

export interface CategoryTime {
  category: string;
  hours: number;
}

export interface Settings {
  tracking: {
    enabled: boolean;
    dedup_threshold_seconds: number;
    poll_interval_ms: number;
  };
  ai: {
    ollama_url: string;
    tier1_model: string;
    tier2_model: string;
    classify_timeout_ms: number;
    min_confidence_threshold: number;
  };
  flow_guard: {
    enabled: boolean;
    threshold_minutes: number;
    interrupt_apps: string[];
  };
  ui: {
    theme: string;
    show_in_tray: boolean;
    show_current_activity_in_tray: boolean;
  };
  cloud: {
    enabled: boolean;
    base_url: string;
    sync_token: string;
    last_sync_at: string | null;
  };
  assistant: AssistantSettings;
}

export interface CloudSyncStatus {
  enabled: boolean;
  configured: boolean;
  base_url: string;
  device_id: string;
  last_sync_at: string | null;
  issues: string[];
  has_local_activity: boolean;
  local_event_days: number;
  local_summary_days: number;
  local_flow_days: number;
}

export interface CloudSyncReport {
  synced_dates: string[];
  uploaded_summaries: number;
  uploaded_project_rollups: number;
  uploaded_flow_sessions: number;
  last_sync_at: string | null;
  failures: string[];
}

export interface Session {
  category: Category;
  apps: string[];
  start_time: string;
  end_time: string;
  duration_seconds: number;
  project: string | null;
  events: Event[];
}

export interface RuleSuggestion {
  app_name: string;
  suggested_category: string;
  event_count: number;
}

export interface WorkBlock {
  id: string;
  label: string;
  sessions: Session[];
  events: Event[];
  categories: Category[];
  dominantCategory: Category;
  apps: string[];
  start_time: string;
  end_time: string;
  duration_seconds: number;
  project: string | null;
  approved: boolean;
}

export interface NlpLogResult {
  events_created: number;
  entries: NlpParsedEntry[];
}

export interface NlpParsedEntry {
  date: string;
  duration_minutes: number;
  category: string;
  project: string | null;
  task_description: string;
}

export interface ManualTimeEntry {
  id: number;
  entry_date: string;
  duration_seconds: number;
  project: string | null;
  category: Category | null;
  task_description: string | null;
  source: "manual" | "manual_nlp";
  timesheet_status: TimesheetStatus;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewManualTimeEntry {
  entry_date: string;
  duration_seconds: number;
  project: string | null;
  category: Category | null;
  task_description: string | null;
  source: "manual" | "manual_nlp";
}

export interface TimesheetRow {
  date: string;
  project: string;
  category: Category | "unknown";
  task_description: string;
  duration_seconds: number;
  duration_label: string;
  duration_hours: number;
  source: "tracked" | ManualTimeEntry["source"];
}

export interface TimesheetExportReadiness {
  ready: boolean;
  unresolvedCount: number;
  counts: Record<TimesheetStatus, number>;
}

export interface TimesheetStatusCounts {
  suggested: number;
  needs_review: number;
  approved: number;
  excluded: number;
}

export interface TimesheetDayData {
  date: string;
  events: Event[];
  manual_entries: ManualTimeEntry[];
  counts: TimesheetStatusCounts;
  unresolved_count: number;
}

export interface TimesheetRangeData {
  start: string;
  end: string;
  events: Event[];
  manual_entries: ManualTimeEntry[];
  counts: TimesheetStatusCounts;
  unresolved_count: number;
}

export interface Summary {
  id: number;
  period_type: string;
  period_start: string;
  period_end: string;
  summary_json: string;
  generated_at: string;
}

export interface DailySummaryData {
  total_hours: number;
  top_category: string;
  top_project: string;
  summary: string;
  productivity_score: number;
}

export type UIVisualState =
  | "normal"
  | "flow"
  | "warning"
  | "critical"
  | "paused"
  | "unknown";

export type TimelineSegmentType = "tracked" | "flow" | "untracked" | "paused";

export interface TimelineSegment {
  type: TimelineSegmentType;
  startPct: number;
  endPct: number;
  durationSeconds: number;
}

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: "navigate" | "classify" | "log" | "toggle";
  execute: () => void | Promise<void>;
  keywords: string[];
}

export type { AssistantContextSnapshot, AssistantSecretStatus, AssistantSettings };

export const CATEGORY_COLORS: Record<Category, string> = {
  coding: "#22c55e",
  communication: "#3b82f6",
  design: "#a855f7",
  documentation: "#f59e0b",
  browsing: "#6b7280",
  meeting: "#ef4444",
  admin: "#14b8a6",
  entertainment: "#f97316",
  unknown: "#d1d5db",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  coding: "Coding",
  communication: "Communication",
  design: "Design",
  documentation: "Documentation",
  browsing: "Browsing",
  meeting: "Meeting",
  admin: "Admin",
  entertainment: "Entertainment",
  unknown: "Unknown",
};
