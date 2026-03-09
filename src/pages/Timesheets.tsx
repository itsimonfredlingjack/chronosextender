import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  addDays,
  endOfWeek,
  format,
  startOfWeek,
  subDays,
} from "date-fns";
import PageTopStrip from "../components/PageTopStrip";
import TimesheetBlockCard from "../components/TimesheetBlockCard";
import ManualTimeEntryCard from "../components/ManualTimeEntryCard";
import CategoryPieChart from "../components/CategoryPieChart";
import { useCommandDeckState } from "../hooks/useCommandDeckState";
import { api } from "../lib/tauri";
import {
  aggregateApprovedTimesheetRows,
  buildTimesheetCsv,
  getBlockTimesheetStatus,
  getTimesheetExportReadiness,
} from "../lib/timesheets";
import { aggregateToWorkBlocks } from "../lib/workblocks";
import { computeLeakage, formatGapDuration } from "../lib/leakage";
import { formatDuration } from "../lib/sessions";
import type {
  Category,
  DailySummaryData,
  NewManualTimeEntry,
  ProjectSummary,
  TimesheetDayData,
  TimesheetRangeData,
  TimesheetStatus,
} from "../lib/types";
import { CATEGORY_LABELS } from "../lib/types";

type Mode = "day" | "week";

const categories: Category[] = [
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

const STATUS_TITLES: Record<TimesheetStatus, string> = {
  suggested: "Suggested",
  needs_review: "Needs Review",
  approved: "Approved",
  excluded: "Excluded",
};

function getWeekBounds(date: Date) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

function createDraftManualEntry(date: string): NewManualTimeEntry {
  return {
    entry_date: date,
    duration_seconds: 1800,
    project: null,
    category: "coding",
    task_description: "",
    source: "manual",
  };
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildRawEventCsv(data: TimesheetRangeData | TimesheetDayData | null): string {
  const events = data?.events ?? [];
  const header =
    "Start,End,App,Title,Project,Category,Task,Duration (min),Timesheet Status\n";
  const rows = events.map((event) =>
    [
      event.start_time,
      event.end_time ?? "",
      event.app_name,
      `"${(event.window_title ?? "").replace(/"/g, '""')}"`,
      event.project ?? "",
      event.category ?? "",
      `"${(event.task_description ?? "").replace(/"/g, '""')}"`,
      Math.round(event.duration_seconds / 60),
      event.timesheet_status ?? "",
    ].join(",")
  );

  return [header.trimEnd(), ...rows].join("\n");
}

export default function Timesheets() {
  const { visualState, statusLabel } = useCommandDeckState();
  const [mode, setMode] = useState<Mode>("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayData, setDayData] = useState<TimesheetDayData | null>(null);
  const [rangeData, setRangeData] = useState<TimesheetRangeData | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [draftManualEntry, setDraftManualEntry] = useState<NewManualTimeEntry>(() =>
    createDraftManualEntry(format(new Date(), "yyyy-MM-dd"))
  );

  const selectedDay = format(selectedDate, "yyyy-MM-dd");
  const weekBounds = useMemo(() => getWeekBounds(selectedDate), [selectedDate]);
  const weekStart = format(weekBounds.start, "yyyy-MM-dd");
  const weekEnd = format(weekBounds.end, "yyyy-MM-dd");

  useEffect(() => {
    setDraftManualEntry((current) => ({
      ...current,
      entry_date: selectedDay,
    }));
  }, [selectedDay]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === "day") {
        const [nextDay, nextProjectSummary, summaryRecord] = await Promise.all([
          api.getTimesheetDay(selectedDay),
          api.getProjectSummary(selectedDay, selectedDay),
          api.getDailySummary(selectedDay),
        ]);
        setDayData(nextDay);
        setRangeData(null);
        setProjectSummary(nextProjectSummary);
        if (summaryRecord) {
          try {
            setDailySummary(JSON.parse(summaryRecord.summary_json));
          } catch {
            setDailySummary(null);
          }
        } else {
          setDailySummary(null);
        }
      } else {
        const [nextRange, nextProjectSummary] = await Promise.all([
          api.getTimesheetRange(weekStart, weekEnd),
          api.getProjectSummary(weekStart, weekEnd),
        ]);
        setRangeData(nextRange);
        setDayData(null);
        setProjectSummary(nextProjectSummary);
        setDailySummary(null);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, selectedDay, weekEnd, weekStart]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    const unlisten = listen("events-changed", () => {
      void refreshData();
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [refreshData]);

  const dayBlocks = useMemo(() => {
    const blocks = aggregateToWorkBlocks(dayData?.events ?? []);
    return blocks.map((block) => ({
      block,
      status: getBlockTimesheetStatus(block.events),
    }));
  }, [dayData]);

  const dayBuckets = useMemo(() => {
    const map: Record<TimesheetStatus, typeof dayBlocks> = {
      suggested: [],
      needs_review: [],
      approved: [],
      excluded: [],
    };

    for (const item of dayBlocks) {
      map[item.status].push(item);
    }

    return map;
  }, [dayBlocks]);

  const leakage = useMemo(
    () => computeLeakage(dayData?.events ?? []),
    [dayData]
  );

  const dayLoggedSeconds = useMemo(() => {
    const eventSeconds =
      dayData?.events.reduce((sum, event) => sum + event.duration_seconds, 0) ?? 0;
    const manualSeconds =
      dayData?.manual_entries
        .filter((entry) => entry.timesheet_status !== "excluded")
        .reduce((sum, entry) => sum + entry.duration_seconds, 0) ?? 0;
    return eventSeconds + manualSeconds;
  }, [dayData]);

  const weekReadiness = useMemo(
    () =>
      getTimesheetExportReadiness({
        events: rangeData?.events ?? [],
        manualEntries: rangeData?.manual_entries ?? [],
      }),
    [rangeData]
  );

  const weekRows = useMemo(
    () =>
      aggregateApprovedTimesheetRows({
        events: rangeData?.events ?? [],
        manualEntries: rangeData?.manual_entries ?? [],
      }),
    [rangeData]
  );

  const weekApprovedSeconds = useMemo(
    () => weekRows.reduce((sum, row) => sum + row.duration_seconds, 0),
    [weekRows]
  );

  const handleApproveBlock = useCallback(
    async (args: {
      eventIds: number[];
      project: string | null;
      category: string;
      taskDescription: string | null;
    }) => {
      setWorking(true);
      try {
        await api.approveTimesheetEvents(args);
        await refreshData();
      } finally {
        setWorking(false);
      }
    },
    [refreshData]
  );

  const handleExcludeBlock = useCallback(
    async (eventIds: number[]) => {
      setWorking(true);
      try {
        await api.setTimesheetEventsStatus(eventIds, "excluded");
        await refreshData();
      } finally {
        setWorking(false);
      }
    },
    [refreshData]
  );

  const handleSaveManualEntry = useCallback(
    async (id: number, entry: NewManualTimeEntry) => {
      await api.updateManualTimeEntry(id, entry);
      await refreshData();
    },
    [refreshData]
  );

  const handleApproveManualEntry = useCallback(
    async (id: number) => {
      await api.setManualTimeEntryStatus(id, "approved");
      await refreshData();
    },
    [refreshData]
  );

  const handleExcludeManualEntry = useCallback(
    async (id: number) => {
      await api.setManualTimeEntryStatus(id, "excluded");
      await refreshData();
    },
    [refreshData]
  );

  const handleDeleteManualEntry = useCallback(
    async (id: number) => {
      await api.deleteManualTimeEntry(id);
      await refreshData();
    },
    [refreshData]
  );

  const handleCreateManualEntry = async () => {
    setWorking(true);
    try {
      await api.createManualTimeEntry(draftManualEntry);
      setDraftManualEntry(createDraftManualEntry(selectedDay));
      await refreshData();
    } finally {
      setWorking(false);
    }
  };

  const handleApproveDay = async () => {
    setWorking(true);
    try {
      await api.approveTimesheetDay(selectedDay);
      await refreshData();
    } finally {
      setWorking(false);
    }
  };

  const handleApproveWeek = async () => {
    setWorking(true);
    try {
      await api.approveTimesheetRange(weekStart, weekEnd);
      await refreshData();
    } finally {
      setWorking(false);
    }
  };

  const handleExportWeek = () => {
    const csv = buildTimesheetCsv(weekRows);
    downloadCsv(`chronos-timesheet-${weekStart}-to-${weekEnd}.csv`, csv);
  };

  const handleExportRaw = () => {
    const source = mode === "day" ? dayData : rangeData;
    downloadCsv(
      mode === "day"
        ? `chronos-raw-${selectedDay}.csv`
        : `chronos-raw-${weekStart}-to-${weekEnd}.csv`,
      buildRawEventCsv(source)
    );
  };

  const isToday = selectedDay === format(new Date(), "yyyy-MM-dd");
  const currentPeriodLabel =
    mode === "day"
      ? isToday
        ? "Today"
        : format(selectedDate, "MMM d")
      : `${format(weekBounds.start, "MMM d")} - ${format(weekBounds.end, "MMM d")}`;

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 w-40 bg-[var(--color-card)] rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)] h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)] gap-4">
          <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)] h-[420px]" />
          <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)] h-[420px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full">
      <PageTopStrip
        title="Timesheets"
        subtitle="Review daily work, finalize weekly time, and export clean hours"
        visualState={visualState}
        statusLabel={statusLabel}
        rightSlot={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-lg p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setMode("day")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === "day"
                    ? "bg-sky-500/14 text-sky-700 border border-sky-500/20"
                    : "text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)]"
                }`}
              >
                Day Review
              </button>
              <button
                onClick={() => setMode("week")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === "week"
                    ? "bg-indigo-500/14 text-indigo-700 border border-indigo-500/20"
                    : "text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)]"
                }`}
              >
                Week Finalize
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-lg p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() =>
                  setSelectedDate((current) => subDays(current, mode === "day" ? 1 : 7))
                }
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)] transition-all"
              >
                {"\u2039"}
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-3 py-1 text-xs font-medium rounded-md text-slate-700 hover:bg-[var(--color-elevated)] transition-all"
              >
                {currentPeriodLabel}
              </button>
              <button
                onClick={() =>
                  setSelectedDate((current) => addDays(current, mode === "day" ? 1 : 7))
                }
                disabled={mode === "day" ? isToday : selectedDate >= new Date()}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {"\u203A"}
              </button>
            </div>

            <button onClick={handleExportRaw} className="btn-ghost text-xs">
              Raw Event CSV
            </button>
          </div>
        )}
      />

      {mode === "day" ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="stat-card-hero">
              <p className="text-[1.75rem] leading-none font-display bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
                {formatDuration(dayLoggedSeconds)}
              </p>
              <p className="text-xs text-slate-600 mt-1.5">Logged today</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">{dayData?.counts.approved ?? 0}</p>
              <p className="text-xs text-slate-600 mt-1.5">Approved items</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">{dayData?.unresolved_count ?? 0}</p>
              <p className="text-xs text-slate-600 mt-1.5">Still unresolved</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">{formatGapDuration(leakage.gapSeconds)}</p>
              <p className="text-xs text-slate-600 mt-1.5">Missing coverage</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)] gap-4 items-start">
            <div className="space-y-4">
              <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Daily confirmation</h3>
                    <p className="text-sm text-slate-600">
                      Review captured work, mark what is export-ready, and fill any missing manual time.
                    </p>
                  </div>
                  <button
                    onClick={handleApproveDay}
                    disabled={working}
                    className="btn-primary text-xs"
                  >
                    {working ? "Saving..." : "Approve Unresolved Day"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Date</span>
                    <input
                      type="date"
                      value={draftManualEntry.entry_date}
                      onChange={(event) =>
                        setDraftManualEntry((current) => ({
                          ...current,
                          entry_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Minutes</span>
                    <input
                      type="number"
                      min={1}
                      value={Math.round(draftManualEntry.duration_seconds / 60)}
                      onChange={(event) =>
                        setDraftManualEntry((current) => ({
                          ...current,
                          duration_seconds: Math.max(1, Number(event.target.value)) * 60,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Project</span>
                    <input
                      value={draftManualEntry.project ?? ""}
                      onChange={(event) =>
                        setDraftManualEntry((current) => ({
                          ...current,
                          project: event.target.value || null,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                      placeholder="Project name"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Category</span>
                    <select
                      value={draftManualEntry.category ?? "coding"}
                      onChange={(event) =>
                        setDraftManualEntry((current) => ({
                          ...current,
                          category: event.target.value as Category,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Task</span>
                    <input
                      value={draftManualEntry.task_description ?? ""}
                      onChange={(event) =>
                        setDraftManualEntry((current) => ({
                          ...current,
                          task_description: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                      placeholder="Retroactive work"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3 mt-4">
                  <p className="text-[11px] text-slate-500">
                    Manual entries land in review first, then become exportable when approved.
                  </p>
                  <button
                    onClick={handleCreateManualEntry}
                    disabled={working}
                    className="btn-ghost text-xs"
                  >
                    Add Manual Entry
                  </button>
                </div>
              </div>

              {(["needs_review", "suggested", "approved", "excluded"] as TimesheetStatus[]).map((status) => {
                const items = dayBuckets[status];
                if (items.length === 0) return null;
                return (
                  <section key={status} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {STATUS_TITLES[status]}
                      </h3>
                      <span className="text-xs text-slate-500">{items.length} block{items.length !== 1 ? "s" : ""}</span>
                    </div>
                    {items.map(({ block, status: blockStatus }) => (
                      <TimesheetBlockCard
                        key={block.id}
                        block={block}
                        status={blockStatus}
                        onApprove={handleApproveBlock}
                        onExclude={handleExcludeBlock}
                      />
                    ))}
                  </section>
                );
              })}

              {dayData?.manual_entries.length ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Manual entries</h3>
                    <span className="text-xs text-slate-500">{dayData.manual_entries.length} entries</span>
                  </div>
                  {dayData.manual_entries.map((entry) => (
                    <ManualTimeEntryCard
                      key={entry.id}
                      entry={entry}
                      onSave={handleSaveManualEntry}
                      onApprove={handleApproveManualEntry}
                      onExclude={handleExcludeManualEntry}
                      onDelete={handleDeleteManualEntry}
                    />
                  ))}
                </section>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-slate-900">Day insights</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Keep the timesheet honest by checking gaps, focus, and project mix.
                </p>
                <div className="mt-4">
                  <CategoryPieChart events={dayData?.events ?? []} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Coverage</p>
                    <p className="text-lg font-semibold text-slate-900">{leakage.coveragePct.toFixed(0)}%</p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Largest gap</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {leakage.gaps[0] ? formatGapDuration(leakage.gaps[0].seconds) : "0m"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-slate-900">Project rollup</h3>
                <div className="mt-3 space-y-2">
                  {projectSummary?.projects.slice(0, 5).map((project) => (
                    <div key={project.project} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 truncate pr-3">{project.project}</span>
                      <span className="font-medium text-slate-900">{project.hours.toFixed(2)}h</span>
                    </div>
                  )) ?? <p className="text-xs text-slate-500">No project activity yet.</p>}
                </div>
              </div>

              {dailySummary ? (
                <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                  <h3 className="text-sm font-semibold text-slate-900">AI summary</h3>
                  <p className="text-sm text-slate-700 mt-3">{dailySummary.summary}</p>
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div className="rounded-xl bg-[var(--color-surface)] p-3">
                      <p className="text-slate-500">Top project</p>
                      <p className="font-medium text-slate-900 mt-1">{dailySummary.top_project}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--color-surface)] p-3">
                      <p className="text-slate-500">Score</p>
                      <p className="font-medium text-slate-900 mt-1">
                        {dailySummary.productivity_score.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="stat-card-hero">
              <p className="text-[1.75rem] leading-none font-display bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                {formatDuration(weekApprovedSeconds)}
              </p>
              <p className="text-xs text-slate-600 mt-1.5">Approved week</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">{weekRows.length}</p>
              <p className="text-xs text-slate-600 mt-1.5">Export rows</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">{rangeData?.unresolved_count ?? 0}</p>
              <p className="text-xs text-slate-600 mt-1.5">Unresolved items</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">
                {projectSummary?.billable_hours.toFixed(1) ?? "0.0"}h
              </p>
              <p className="text-xs text-slate-600 mt-1.5">Billable rollup</p>
            </div>
          </div>

          {!weekReadiness.ready ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 text-sm text-amber-800">
              {weekReadiness.unresolvedCount} item{weekReadiness.unresolvedCount !== 1 ? "s" : ""} still need review or approval before export.
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 text-sm text-emerald-800">
              This week is ready to export. Only approved rows will be included.
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)] gap-4 items-start">
            <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Weekly finalize</h3>
                  <p className="text-sm text-slate-600">
                    Collapse approved work into leader-ready rows, then export the finished timesheet.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={handleApproveWeek} disabled={working} className="btn-ghost text-xs">
                    {working ? "Saving..." : "Approve Unresolved Week"}
                  </button>
                  <button
                    onClick={handleExportWeek}
                    disabled={!weekReadiness.ready || weekRows.length === 0}
                    className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Export Timesheet CSV
                  </button>
                </div>
              </div>

              {weekRows.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500">
                  No approved rows yet for this week.
                </div>
              ) : (
                <div className="mt-4 overflow-auto rounded-2xl border border-[var(--color-border)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--color-surface)] text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Project</th>
                        <th className="px-4 py-3 text-left font-medium">Task</th>
                        <th className="px-4 py-3 text-left font-medium">Category</th>
                        <th className="px-4 py-3 text-right font-medium">H:MM</th>
                        <th className="px-4 py-3 text-right font-medium">Hours</th>
                        <th className="px-4 py-3 text-left font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekRows.map((row) => (
                        <tr key={`${row.date}-${row.project}-${row.task_description}-${row.source}`} className="border-t border-[var(--color-border)]">
                          <td className="px-4 py-3 text-slate-700">{row.date}</td>
                          <td className="px-4 py-3 text-slate-900 font-medium">{row.project}</td>
                          <td className="px-4 py-3 text-slate-700">{row.task_description}</td>
                          <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[row.category as Category] ?? row.category}</td>
                          <td className="px-4 py-3 text-right font-data text-slate-900">{row.duration_label}</td>
                          <td className="px-4 py-3 text-right font-data text-slate-900">{row.duration_hours.toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-600">{row.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-slate-900">Export readiness</h3>
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Suggested</p>
                    <p className="text-lg font-semibold text-slate-900">{weekReadiness.counts.suggested}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Needs review</p>
                    <p className="text-lg font-semibold text-slate-900">{weekReadiness.counts.needs_review}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Approved</p>
                    <p className="text-lg font-semibold text-slate-900">{weekReadiness.counts.approved}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Excluded</p>
                    <p className="text-lg font-semibold text-slate-900">{weekReadiness.counts.excluded}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-slate-900">Project totals</h3>
                <div className="mt-3 space-y-2">
                  {projectSummary?.projects.slice(0, 6).map((project) => (
                    <div key={project.project} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 truncate pr-3">{project.project}</span>
                      <span className="font-medium text-slate-900">{project.hours.toFixed(2)}h</span>
                    </div>
                  )) ?? <p className="text-xs text-slate-500">No time captured in this range.</p>}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
