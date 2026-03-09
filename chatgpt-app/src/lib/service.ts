import type {
  CloudDaySummaryPayload,
  CloudFlowSessionPayload,
  CloudProjectRollupPayload,
  DayOverview,
  Env,
  FlowSnapshot,
  FlowSummary,
  ProjectBreakdown,
  ProjectSnapshot,
  RecentSummaries,
  ReportWidgetMeta,
  ReportWidgetStructuredContent,
  SummarySnapshot,
  SyncAck,
  WidgetPeriod,
} from "./contracts";

type SummaryRow = {
  date: string;
  totalHours: number;
  topCategory: string;
  topProject: string;
  summary: string;
  productivityScore: number;
  eventCount: number;
};

type ProjectRow = {
  project: string;
  client: string | null;
  color: string;
  billable: number;
  hours: number;
  activeDays?: number;
};

type FlowRow = {
  startedAt: string;
  endedAt: string;
  primaryApp: string;
  primaryProject: string | null;
  durationMinutes: number;
  interrupted: number;
  interruptedBy: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseBillable(value: number): boolean {
  return value === 1;
}

function asSummarySnapshot(row: SummaryRow): SummarySnapshot {
  return {
    date: row.date,
    totalHours: row.totalHours,
    topCategory: row.topCategory,
    topProject: row.topProject,
    summary: row.summary,
    productivityScore: row.productivityScore,
    eventCount: row.eventCount,
  };
}

function asProjectSnapshot(row: ProjectRow): ProjectSnapshot {
  return {
    project: row.project,
    client: row.client,
    color: row.color,
    billable: parseBillable(row.billable),
    hours: row.hours,
    activeDays: row.activeDays,
  };
}

function asFlowSnapshot(row: FlowRow): FlowSnapshot {
  return {
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    primaryApp: row.primaryApp,
    primaryProject: row.primaryProject,
    durationMinutes: row.durationMinutes,
    interrupted: row.interrupted === 1,
    interruptedBy: row.interruptedBy,
  };
}

export function summariseFlowSessions(sessions: FlowSnapshot[]): FlowSummary {
  return {
    totalMinutes: sessions.reduce((sum, session) => sum + session.durationMinutes, 0),
    interruptedCount: sessions.filter((session) => session.interrupted).length,
    sessions,
  };
}

export function summariseProjectBreakdown(
  rows: Array<ProjectSnapshot>,
  range: { startDate: string; endDate: string },
  dailyTotals: Array<{ date: string; totalHours: number }>
): ProjectBreakdown {
  const sorted = [...rows].sort((left, right) => right.hours - left.hours);
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    totalHours: Number(sorted.reduce((sum, row) => sum + row.hours, 0).toFixed(2)),
    billableHours: Number(
      sorted.reduce((sum, row) => sum + (row.billable ? row.hours : 0), 0).toFixed(2)
    ),
    dailyTotals,
    projects: sorted,
  };
}

function dateFromIso(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number): string {
  const value = dateFromIso(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return formatDate(value);
}

export function pickLatestSyncedDate(
  candidates: Array<string | null | undefined>,
  fallbackDate: string
): string {
  const latest = candidates
    .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0)
    .sort()
    .at(-1);

  return latest ?? fallbackDate;
}

function resolveRange(
  period: WidgetPeriod,
  latestDate: string,
  startDate?: string,
  endDate?: string
): { startDate: string; endDate: string; focusDate: string } {
  const safeEnd = endDate ?? latestDate;
  const safeStart = startDate ?? safeEnd;

  switch (period) {
    case "day":
      return { startDate: safeStart, endDate: safeEnd, focusDate: safeEnd };
    case "week":
      return {
        startDate: startDate ?? addDays(safeEnd, -6),
        endDate: safeEnd,
        focusDate: safeEnd,
      };
    case "month":
      return {
        startDate: startDate ?? addDays(safeEnd, -29),
        endDate: safeEnd,
        focusDate: safeEnd,
      };
    case "custom":
    default:
      return {
        startDate: safeStart <= safeEnd ? safeStart : safeEnd,
        endDate: safeEnd >= safeStart ? safeEnd : safeStart,
        focusDate: safeEnd,
      };
  }
}

function buildHeadline(
  period: WidgetPeriod,
  breakdown: ProjectBreakdown,
  summary: SummarySnapshot | null
): string {
  if (breakdown.totalHours <= 0 && !summary) {
    return "No synced activity yet";
  }

  const hours = breakdown.totalHours > 0 ? `${breakdown.totalHours.toFixed(1)} hours logged` : "";
  const project = summary?.topProject ? `Top project: ${summary.topProject}` : "";
  const periodLabel =
    period === "day" ? "for the day" : period === "week" ? "for the week" : "for the period";

  return [hours, project, periodLabel].filter(Boolean).join(" • ");
}

function derivePlatform(deviceId: string): string | null {
  const platform = deviceId.split("-").at(-1);
  return platform && platform.length > 0 ? platform : null;
}

async function ensureIdentity(env: Env, accountId: string, deviceId: string): Promise<void> {
  const timestamp = nowIso();
  const platform = derivePlatform(deviceId);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO accounts (account_id, display_name)
       VALUES (?, ?)
       ON CONFLICT(account_id) DO NOTHING`
    ).bind(accountId, "Chronos Owner"),
    env.DB.prepare(
      `INSERT INTO devices (account_id, device_id, platform, last_seen_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id, device_id)
       DO UPDATE SET
         platform = excluded.platform,
         last_seen_at = excluded.last_seen_at`
    ).bind(accountId, deviceId, platform, timestamp),
    env.DB.prepare(
      `INSERT INTO sync_state (account_id, device_id, last_sync_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id, device_id)
       DO UPDATE SET
         last_sync_at = excluded.last_sync_at,
         updated_at = excluded.updated_at`
    ).bind(accountId, deviceId, timestamp, timestamp),
  ]);
}

function assertOwnerAccount(accountId: string, env: Env): void {
  const owner = env.CHRONOS_ACCOUNT_ID ?? "owner";
  if (accountId !== owner) {
    throw new Error(`Unsupported account_id ${accountId}`);
  }
}

export async function upsertDailySummary(
  env: Env,
  payload: CloudDaySummaryPayload
): Promise<SyncAck> {
  assertOwnerAccount(payload.account_id, env);
  await ensureIdentity(env, payload.account_id, payload.device_id);

  const syncedAt = nowIso();
  await env.DB.prepare(
    `INSERT INTO daily_summaries (
      account_id, device_id, date, total_hours, top_category, top_project, summary,
      productivity_score, event_count, synced_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, device_id, date)
    DO UPDATE SET
      total_hours = excluded.total_hours,
      top_category = excluded.top_category,
      top_project = excluded.top_project,
      summary = excluded.summary,
      productivity_score = excluded.productivity_score,
      event_count = excluded.event_count,
      synced_at = excluded.synced_at`
  )
    .bind(
      payload.account_id,
      payload.device_id,
      payload.date,
      payload.total_hours,
      payload.top_category,
      payload.top_project,
      payload.summary,
      payload.productivity_score,
      payload.event_count,
      syncedAt
    )
    .run();

  await env.DB.prepare(
    `UPDATE sync_state
     SET last_sync_at = ?, updated_at = ?
     WHERE account_id = ? AND device_id = ?`
  )
    .bind(syncedAt, syncedAt, payload.account_id, payload.device_id)
    .run();

  return {
    ok: true,
    synced: 1,
    accountId: payload.account_id,
    deviceId: payload.device_id,
    lastSyncAt: syncedAt,
  };
}

export async function upsertProjectRollups(
  env: Env,
  payloads: CloudProjectRollupPayload[]
): Promise<SyncAck> {
  if (payloads.length === 0) {
    return {
      ok: true,
      synced: 0,
      accountId: env.CHRONOS_ACCOUNT_ID ?? "owner",
      deviceId: "unknown",
      lastSyncAt: nowIso(),
    };
  }

  const first = payloads[0];
  assertOwnerAccount(first.account_id, env);
  await ensureIdentity(env, first.account_id, first.device_id);

  const syncedAt = nowIso();
  await env.DB.batch(
    payloads.map((payload) =>
      env.DB.prepare(
        `INSERT INTO project_rollups (
          account_id, device_id, date, project, client, color, billable, hours, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, device_id, date, project)
        DO UPDATE SET
          client = excluded.client,
          color = excluded.color,
          billable = excluded.billable,
          hours = excluded.hours,
          synced_at = excluded.synced_at`
      ).bind(
        payload.account_id,
        payload.device_id,
        payload.date,
        payload.project,
        payload.client,
        payload.color,
        payload.billable ? 1 : 0,
        payload.hours,
        syncedAt
      )
    )
  );

  await env.DB.prepare(
    `UPDATE sync_state
     SET last_sync_at = ?, updated_at = ?
     WHERE account_id = ? AND device_id = ?`
  )
    .bind(syncedAt, syncedAt, first.account_id, first.device_id)
    .run();

  return {
    ok: true,
    synced: payloads.length,
    accountId: first.account_id,
    deviceId: first.device_id,
    lastSyncAt: syncedAt,
  };
}

export async function upsertFlowSessions(
  env: Env,
  payloads: CloudFlowSessionPayload[]
): Promise<SyncAck> {
  if (payloads.length === 0) {
    return {
      ok: true,
      synced: 0,
      accountId: env.CHRONOS_ACCOUNT_ID ?? "owner",
      deviceId: "unknown",
      lastSyncAt: nowIso(),
    };
  }

  const first = payloads[0];
  assertOwnerAccount(first.account_id, env);
  await ensureIdentity(env, first.account_id, first.device_id);

  const syncedAt = nowIso();
  await env.DB.batch(
    payloads.map((payload) =>
      env.DB.prepare(
        `INSERT INTO flow_sessions (
          account_id, device_id, date, started_at, ended_at, primary_app, primary_project,
          duration_minutes, interrupted, interrupted_by, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, device_id, started_at)
        DO UPDATE SET
          date = excluded.date,
          ended_at = excluded.ended_at,
          primary_app = excluded.primary_app,
          primary_project = excluded.primary_project,
          duration_minutes = excluded.duration_minutes,
          interrupted = excluded.interrupted,
          interrupted_by = excluded.interrupted_by,
          synced_at = excluded.synced_at`
      ).bind(
        payload.account_id,
        payload.device_id,
        payload.date,
        payload.started_at,
        payload.ended_at,
        payload.primary_app,
        payload.primary_project,
        payload.duration_minutes,
        payload.interrupted ? 1 : 0,
        payload.interrupted_by,
        syncedAt
      )
    )
  );

  await env.DB.prepare(
    `UPDATE sync_state
     SET last_sync_at = ?, updated_at = ?
     WHERE account_id = ? AND device_id = ?`
  )
    .bind(syncedAt, syncedAt, first.account_id, first.device_id)
    .run();

  return {
    ok: true,
    synced: payloads.length,
    accountId: first.account_id,
    deviceId: first.device_id,
    lastSyncAt: syncedAt,
  };
}

async function getSummaryForDate(
  env: Env,
  accountId: string,
  date: string
): Promise<SummarySnapshot | null> {
  const row = await env.DB.prepare(
    `SELECT
      date,
      total_hours AS totalHours,
      top_category AS topCategory,
      top_project AS topProject,
      summary,
      productivity_score AS productivityScore,
      event_count AS eventCount
    FROM daily_summaries
    WHERE account_id = ? AND date = ?
    ORDER BY synced_at DESC
    LIMIT 1`
  )
    .bind(accountId, date)
    .first<SummaryRow>();

  return row ? asSummarySnapshot(row) : null;
}

async function getProjectsForDate(
  env: Env,
  accountId: string,
  date: string
): Promise<ProjectSnapshot[]> {
  const result = await env.DB.prepare(
    `SELECT
      project,
      client,
      color,
      billable,
      SUM(hours) AS hours
    FROM project_rollups
    WHERE account_id = ? AND date = ?
    GROUP BY project, client, color, billable
    ORDER BY hours DESC`
  )
    .bind(accountId, date)
    .all<ProjectRow>();

  return (result.results ?? []).map(asProjectSnapshot);
}

async function getFlowForDate(env: Env, accountId: string, date: string): Promise<FlowSummary> {
  const result = await env.DB.prepare(
    `SELECT
      started_at AS startedAt,
      ended_at AS endedAt,
      primary_app AS primaryApp,
      primary_project AS primaryProject,
      duration_minutes AS durationMinutes,
      interrupted,
      interrupted_by AS interruptedBy
    FROM flow_sessions
    WHERE account_id = ? AND date = ?
    ORDER BY started_at DESC`
  )
    .bind(accountId, date)
    .all<FlowRow>();

  return summariseFlowSessions((result.results ?? []).map(asFlowSnapshot));
}

export async function getDayOverview(
  env: Env,
  accountId: string,
  date: string
): Promise<DayOverview> {
  const [summary, topProjects, flow] = await Promise.all([
    getSummaryForDate(env, accountId, date),
    getProjectsForDate(env, accountId, date),
    getFlowForDate(env, accountId, date),
  ]);

  return {
    date,
    summary,
    topProjects,
    flow,
  };
}

export async function getProjectBreakdown(
  env: Env,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<ProjectBreakdown> {
  const [projectsResult, totalsResult] = await Promise.all([
    env.DB
      .prepare(
        `SELECT
          project,
          client,
          color,
          billable,
          SUM(hours) AS hours,
          COUNT(DISTINCT date) AS activeDays
        FROM project_rollups
        WHERE account_id = ? AND date BETWEEN ? AND ?
        GROUP BY project, client, color, billable
        ORDER BY hours DESC`
      )
      .bind(accountId, startDate, endDate)
      .all<ProjectRow>(),
    env.DB
      .prepare(
        `SELECT
          date,
          SUM(hours) AS totalHours
        FROM project_rollups
        WHERE account_id = ? AND date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date`
      )
      .bind(accountId, startDate, endDate)
      .all<{ date: string; totalHours: number }>(),
  ]);

  return summariseProjectBreakdown(
    (projectsResult.results ?? []).map(asProjectSnapshot),
    { startDate, endDate },
    totalsResult.results ?? []
  );
}

export async function getFlowSessionsForDate(
  env: Env,
  accountId: string,
  date: string
): Promise<FlowSummary> {
  return getFlowForDate(env, accountId, date);
}

export async function getRecentSummaries(
  env: Env,
  accountId: string,
  limit: number
): Promise<RecentSummaries> {
  const result = await env.DB.prepare(
    `SELECT
      date,
      total_hours AS totalHours,
      top_category AS topCategory,
      top_project AS topProject,
      summary,
      productivity_score AS productivityScore,
      event_count AS eventCount
    FROM daily_summaries
    WHERE account_id = ?
    ORDER BY date DESC
    LIMIT ?`
  )
    .bind(accountId, limit)
    .all<SummaryRow>();

  return {
    limit,
    summaries: (result.results ?? []).map(asSummarySnapshot),
  };
}

async function getLatestActivityDate(env: Env, accountId: string): Promise<string> {
  const [summaryRow, projectRow, flowRow] = await Promise.all([
    env.DB
      .prepare(
        `SELECT date
         FROM daily_summaries
         WHERE account_id = ?
         ORDER BY date DESC
         LIMIT 1`
      )
      .bind(accountId)
      .first<{ date: string }>(),
    env.DB
      .prepare(
        `SELECT date
         FROM project_rollups
         WHERE account_id = ?
         ORDER BY date DESC
         LIMIT 1`
      )
      .bind(accountId)
      .first<{ date: string }>(),
    env.DB
      .prepare(
        `SELECT date
         FROM flow_sessions
         WHERE account_id = ?
         ORDER BY date DESC
         LIMIT 1`
      )
      .bind(accountId)
      .first<{ date: string }>(),
  ]);

  return pickLatestSyncedDate(
    [summaryRow?.date, projectRow?.date, flowRow?.date],
    formatDate(new Date())
  );
}

async function getSummariesInRange(
  env: Env,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<SummarySnapshot[]> {
  const result = await env.DB.prepare(
    `SELECT
      date,
      total_hours AS totalHours,
      top_category AS topCategory,
      top_project AS topProject,
      summary,
      productivity_score AS productivityScore,
      event_count AS eventCount
    FROM daily_summaries
    WHERE account_id = ? AND date BETWEEN ? AND ?
    ORDER BY date DESC`
  )
    .bind(accountId, startDate, endDate)
    .all<SummaryRow>();

  return (result.results ?? []).map(asSummarySnapshot);
}

export async function getReportWidgetData(
  env: Env,
  accountId: string,
  period: WidgetPeriod,
  startDate?: string,
  endDate?: string
): Promise<{ structuredContent: ReportWidgetStructuredContent; meta: ReportWidgetMeta }> {
  const latestDate = await getLatestActivityDate(env, accountId);
  const range = resolveRange(period, latestDate, startDate, endDate);
  const [breakdown, dayOverview, summaries] = await Promise.all([
    getProjectBreakdown(env, accountId, range.startDate, range.endDate),
    getDayOverview(env, accountId, range.focusDate),
    getSummariesInRange(env, accountId, range.startDate, range.endDate),
  ]);

  const structuredContent: ReportWidgetStructuredContent = {
    period,
    range,
    headline: buildHeadline(period, breakdown, dayOverview.summary),
    summary: dayOverview.summary,
    topProjects: breakdown.projects.slice(0, 5),
    flow: dayOverview.flow,
    trendCards: summaries.slice(0, 5).map((summary) => ({
      date: summary.date,
      totalHours: summary.totalHours,
      topProject: summary.topProject,
      productivityScore: summary.productivityScore,
    })),
  };

  const meta: ReportWidgetMeta = {
    charts: {
      trend: summaries
        .slice()
        .reverse()
        .map((summary) => ({
          date: summary.date,
          totalHours: summary.totalHours,
          productivityScore: summary.productivityScore,
        })),
      projects: breakdown.projects.slice(0, 6).map((project) => ({
        project: project.project,
        hours: project.hours,
        color: project.color,
      })),
    },
    emptyState:
      !structuredContent.summary &&
      structuredContent.topProjects.length === 0 &&
      structuredContent.flow.sessions.length === 0,
  };

  return { structuredContent, meta };
}
