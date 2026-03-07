export type AIProvider = "openai" | "anthropic" | "local";

export type AIRole = "user" | "assistant";

export interface AssistantMessage {
  id: string;
  role: AIRole;
  content: string;
  createdAt: string;
}

export interface AppContextSnapshot {
  currentView: string;
  dateRange: string;
  summaryLines: string[];
  recentEntries: string[];
}

export interface ResponseInputMessage {
  role: AIRole;
  content: string;
}

export interface AssistantSettings {
  enabled: boolean;
  provider: AIProvider;
  model: string;
  temperature: number;
  system_prompt: string;
  local_base_url: string;
}

export interface AssistantContextEvent {
  start_time: string;
  end_time: string | null;
  project: string | null;
  category: string | null;
  app_name: string;
  task_description: string | null;
}

export interface AssistantRecentSummary {
  date: string;
  total_hours: number;
  top_category: string;
  top_project: string;
  summary: string;
  productivity_score: number;
}

export interface AssistantProjectTotal {
  project: string;
  seconds: number;
}

export interface AssistantContextSnapshot {
  current_date: string;
  today_total_seconds: number;
  week_total_seconds: number;
  today_event_count: number;
  pending_count: number;
  current_flow_minutes: number;
  top_projects: AssistantProjectTotal[];
  recent_events: AssistantContextEvent[];
  recent_summaries: AssistantRecentSummary[];
}

export interface AssistantStreamState {
  text: string;
  completed: boolean;
  error: string | null;
}

export type AssistantStreamEvent =
  | { type: "response.output_text.delta"; delta: string }
  | { type: "response.completed" }
  | { type: "response.error"; error: string };

export interface AssistantSecretStatus {
  provider: AIProvider;
  configured: boolean;
}

export interface AssistantStreamEnvelope {
  request_id: string;
  event_type: AssistantStreamEvent["type"];
  delta?: string | null;
  error?: string | null;
}
