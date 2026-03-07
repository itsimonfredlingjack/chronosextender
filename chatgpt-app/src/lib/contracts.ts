export type CloudDaySummaryPayload = {
  account_id: string;
  device_id: string;
  date: string;
  total_hours: number;
  top_category: string;
  top_project: string;
  summary: string;
  productivity_score: number;
  event_count: number;
};

export type CloudProjectRollupPayload = {
  account_id: string;
  device_id: string;
  date: string;
  project: string;
  client: string | null;
  color: string;
  billable: boolean;
  hours: number;
};

export type CloudFlowSessionPayload = {
  account_id: string;
  device_id: string;
  date: string;
  primary_app: string;
  primary_project: string | null;
  duration_minutes: number;
  interrupted: boolean;
  interrupted_by: string | null;
  started_at: string;
  ended_at: string;
};

export type SyncAck = {
  ok: true;
  synced: number;
  accountId: string;
  deviceId: string;
  lastSyncAt: string;
};

export type SummarySnapshot = {
  date: string;
  totalHours: number;
  topCategory: string;
  topProject: string;
  summary: string;
  productivityScore: number;
  eventCount: number;
};

export type ProjectSnapshot = {
  project: string;
  client: string | null;
  color: string;
  billable: boolean;
  hours: number;
  activeDays?: number;
};

export type FlowSnapshot = {
  startedAt: string;
  endedAt: string;
  primaryApp: string;
  primaryProject: string | null;
  durationMinutes: number;
  interrupted: boolean;
  interruptedBy: string | null;
};

export type FlowSummary = {
  totalMinutes: number;
  interruptedCount: number;
  sessions: FlowSnapshot[];
};

export type DayOverview = {
  date: string;
  summary: SummarySnapshot | null;
  topProjects: ProjectSnapshot[];
  flow: FlowSummary;
};

export type ProjectBreakdown = {
  startDate: string;
  endDate: string;
  totalHours: number;
  billableHours: number;
  dailyTotals: Array<{ date: string; totalHours: number }>;
  projects: ProjectSnapshot[];
};

export type RecentSummaries = {
  limit: number;
  summaries: SummarySnapshot[];
};

export type WidgetTrendCard = {
  date: string;
  totalHours: number;
  topProject: string;
  productivityScore: number;
};

export type WidgetChartData = {
  trend: Array<{ date: string; totalHours: number; productivityScore: number }>;
  projects: Array<{ project: string; hours: number; color: string }>;
};

export type ReportWidgetStructuredContent = {
  period: WidgetPeriod;
  range: {
    startDate: string;
    endDate: string;
    focusDate: string;
  };
  headline: string;
  summary: SummarySnapshot | null;
  topProjects: ProjectSnapshot[];
  flow: FlowSummary;
  trendCards: WidgetTrendCard[];
};

export type ReportWidgetMeta = {
  charts: WidgetChartData;
  emptyState: boolean;
};

export type WidgetPeriod = "day" | "week" | "month" | "custom";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  CHRONOS_ACCOUNT_ID?: string;
  CHRONOS_APP_ORIGIN?: string;
  CHRONOS_SYNC_TOKEN?: string;
}
