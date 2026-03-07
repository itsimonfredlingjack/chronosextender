import { invoke } from "@tauri-apps/api/core";
import type {
  AssistantContextSnapshot,
  AssistantSecretStatus,
  Event,
  CloudSyncReport,
  CloudSyncStatus,
  FlowSession,
  FlowStatus,
  NewProject,
  NewRule,
  NlpLogResult,
  OllamaStatus,
  Project,
  ProjectSummary,
  Rule,
  RuleSuggestion,
  Settings,
  Summary,
} from "./types";
import type { AssistantMessage } from "../types/ai-types";

export const api = {
  getTodayEvents: () => invoke<Event[]>("get_today_events"),

  getTimeline: (date: string) => invoke<Event[]>("get_timeline", { date }),

  getPendingEvents: () => invoke<Event[]>("get_pending_events"),

  reclassifyEvent: (
    eventId: number,
    project: string | null,
    category: string,
    taskDescription: string | null
  ) =>
    invoke<boolean>("reclassify_event", {
      eventId,
      project,
      category,
      taskDescription,
    }),

  getProjects: () => invoke<Project[]>("get_projects"),

  upsertProject: (project: NewProject) =>
    invoke<number>("upsert_project", { project }),

  getRules: () => invoke<Rule[]>("get_rules"),

  addRule: (rule: NewRule) => invoke<number>("add_rule", { rule }),

  deleteRule: (id: number) => invoke<boolean>("delete_rule", { id }),

  getRuleSuggestions: () => invoke<RuleSuggestion[]>("get_rule_suggestions"),

  getFlowStatus: () => invoke<FlowStatus>("get_flow_status"),

  getFlowSessions: (date: string) =>
    invoke<FlowSession[]>("get_flow_sessions", { date }),

  getOllamaStatus: () => invoke<OllamaStatus>("get_ollama_status"),

  getCloudSyncStatus: () => invoke<CloudSyncStatus>("get_cloud_sync_status"),

  getSettings: () => invoke<Settings>("get_settings"),

  updateSettings: (settings: Settings) =>
    invoke<boolean>("update_settings", { settings }),

  getProjectSummary: (start: string, end: string) =>
    invoke<ProjectSummary>("get_project_summary", { start, end }),

  toggleTracking: () => invoke<boolean>("toggle_tracking"),

  showOverlay: () => invoke("show_overlay"),
  hideOverlay: () => invoke("hide_overlay"),
  showDashboard: () => invoke("show_dashboard"),
  getPendingCount: () => invoke<number>("get_pending_count"),
  getTrackingActive: () => invoke<boolean>("get_tracking_active"),
  triggerBatchReclassify: () => invoke<number>("trigger_batch_reclassify"),
  triggerDailySummary: (date: string) => invoke<string>("trigger_daily_summary", { date }),
  logTimeNlp: (input: string) => invoke<NlpLogResult>("log_time_nlp", { input }),
  getDailySummary: (date: string) => invoke<Summary | null>("get_daily_summary", { date }),
  syncCloudNow: () => invoke<CloudSyncReport>("sync_cloud_now"),
  getAssistantContextSnapshot: () =>
    invoke<AssistantContextSnapshot>("get_assistant_context_snapshot"),
  getAssistantSecretStatus: (provider: string) =>
    invoke<AssistantSecretStatus>("get_assistant_secret_status", { provider }),
  setAssistantApiKey: (provider: string, apiKey: string) =>
    invoke<boolean>("set_assistant_api_key", { provider, apiKey }),
  clearAssistantApiKey: (provider: string) =>
    invoke<boolean>("clear_assistant_api_key", { provider }),
  startAssistantStream: (request: {
    requestId: string;
    history: AssistantMessage[];
    contextXml: string;
    userMessage: string;
  }) =>
    invoke<boolean>("start_assistant_stream", {
      request: {
        request_id: request.requestId,
        history: request.history,
        context_xml: request.contextXml,
        user_message: request.userMessage,
      },
    }),
  cancelAssistantStream: (requestId: string) =>
    invoke<boolean>("cancel_assistant_stream", { requestId }),
};
