import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { addDays, format, subDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useCommandDeckState } from "../hooks/useCommandDeckState";
import { api } from "../lib/tauri";
import type {
  Category,
  DailySummaryData,
  Project,
  TimesheetDayData,
} from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import { computeLeakage, formatGapDuration } from "../lib/leakage";
import { buildReportOverview } from "../lib/reports";
import PageTopStrip from "../components/PageTopStrip";

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
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

export default function Reports() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reportDay, setReportDay] = useState<TimesheetDayData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { visualState, statusLabel } = useCommandDeckState();

  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

  const refreshData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const [dayResult, projectsResult, summaryResult] = await Promise.allSettled([
        api.getTimesheetDay(dateStr),
        api.getProjects(),
        api.getDailySummary(dateStr),
      ]);

      setLoadError(
        dayResult.status === "rejected"
          ? "Chronos could not load this report right now. Your local data is unchanged."
          : null
      );
      setReportDay(dayResult.status === "fulfilled" ? dayResult.value : null);
      setProjects(projectsResult.status === "fulfilled" ? projectsResult.value : []);

      if (summaryResult.status === "fulfilled" && summaryResult.value) {
        try {
          setSummary(JSON.parse(summaryResult.value.summary_json));
        } catch {
          setSummary(null);
        }
      } else {
        setSummary(null);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [dateStr]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    const unlisten = listen("events-changed", () => {
      void refreshData(false);
    });
    const interval = window.setInterval(() => {
      void refreshData(false);
    }, 15_000);

    return () => {
      window.clearInterval(interval);
      unlisten.then((stop) => stop());
    };
  }, [refreshData]);

  const events = reportDay?.events ?? [];
  const manualEntries = reportDay?.manual_entries ?? [];

  const reportOverview = useMemo(
    () =>
      buildReportOverview({
        events,
        manualEntries,
        projects,
      }),
    [events, manualEntries, projects]
  );

  const leakage = useMemo(() => computeLeakage(events), [events]);

  const includedItems =
    reportOverview.counts.approved +
    reportOverview.counts.suggested +
    reportOverview.counts.needs_review;

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const raw = await api.triggerDailySummary(dateStr);
      try {
        setSummary(JSON.parse(raw));
      } catch {
        setSummary(null);
      }
    } catch {
      // Summary generation is optional; keep the current report state.
    } finally {
      setGeneratingSummary(false);
    }
  };

  const exportEventsCsv = () => {
    const header =
      "Start,End,App,Title,Category,Project,Task,Duration (min),Timesheet Status\n";
    const rows = events
      .map((event) =>
        [
          event.start_time,
          event.end_time ?? "",
          event.app_name,
          `"${(event.window_title ?? "").replace(/"/g, '""')}"`,
          event.category ?? "",
          event.project ?? "",
          `"${(event.task_description ?? "").replace(/"/g, '""')}"`,
          Math.round(event.duration_seconds / 60),
          event.timesheet_status ?? "",
        ].join(",")
      )
      .join("\n");

    downloadCsv(`chronos-report-events-${dateStr}.csv`, [header.trimEnd(), rows].filter(Boolean).join("\n"));
  };

  const exportProjectsCsv = () => {
    const header = "Project,Hours,Billable\n";
    const rows = reportOverview.projectBreakdown
      .map((project) => `"${project.project}",${project.hours.toFixed(2)},${project.billable ? "Yes" : "No"}`)
      .join("\n");

    downloadCsv(
      `chronos-projects-${dateStr}.csv`,
      [header.trimEnd(), rows].filter(Boolean).join("\n")
    );
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-6 w-24 bg-[var(--color-card)] rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[var(--color-card)] rounded-xl p-4 border border-[var(--color-border)] space-y-2"
            >
              <div className="h-6 w-16 bg-[var(--color-elevated)] rounded" />
              <div className="h-3 w-20 bg-[var(--color-elevated)] rounded" />
            </div>
          ))}
        </div>
        <div className="bg-[var(--color-card)] rounded-xl p-4 border border-[var(--color-border)] h-32" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full">
      <PageTopStrip
        title="Reports"
        subtitle="See where time went, what still needs attention, and what is ready to export."
        visualState={visualState}
        statusLabel={statusLabel}
        rightSlot={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-lg p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setSelectedDate((date) => subDays(date, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)] transition-all"
              >
                {"\u2039"}
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  isToday
                    ? "bg-gradient-to-r from-indigo-500/14 to-blue-500/18 text-indigo-700 border border-indigo-500/25"
                    : "text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)]"
                }`}
              >
                {isToday ? "Today" : format(selectedDate, "MMM d")}
              </button>
              <button
                onClick={() => setSelectedDate((date) => addDays(date, 1))}
                disabled={isToday}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {"\u203A"}
              </button>
            </div>
            <button onClick={exportEventsCsv} className="btn-ghost text-xs">
              Raw Events CSV
            </button>
            <button
              onClick={exportProjectsCsv}
              disabled={reportOverview.projectBreakdown.length === 0}
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Project Rollup CSV
            </button>
          </div>
        )}
      />

      {loadError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-800">Report data unavailable</p>
            <p className="text-sm text-red-700 mt-1">{loadError}</p>
          </div>
          <button onClick={() => void refreshData()} className="btn-ghost text-xs">
            Retry
          </button>
        </div>
      ) : null}

      {loadError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-2xl bg-red-500/10 rotate-6" />
            <div className="absolute inset-0 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center">
              <span className="text-2xl text-red-500">!</span>
            </div>
          </div>
          <p className="text-sm text-slate-700 font-medium">This report could not be loaded</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
            Retry the report load. If this keeps happening, check the local database and tracking service state.
          </p>
        </div>
      ) : reportOverview.loggedSeconds === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/12 to-blue-500/12 rotate-6" />
            <div className="absolute inset-0 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center">
              <span className="text-2xl text-slate-500">▥</span>
            </div>
          </div>
          <p className="text-sm text-slate-600 font-medium">No reported time for this date</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
            {isToday
              ? "Tracked work and approved manual time will appear here as soon as Chronos captures your day."
              : "Pick a day with activity, or add manual time from Timesheets to build the report."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <div className="stat-card-hero">
              <p className="text-[1.75rem] leading-none font-display bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                {formatHours(reportOverview.loggedSeconds)}
              </p>
              <p className="text-xs text-slate-600 mt-1.5">Logged time</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">
                {reportOverview.billableHours.toFixed(1)}h
              </p>
              <p className="text-xs text-slate-600 mt-1.5">Billable</p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">
                {reportOverview.unresolvedCount}
              </p>
              <p className="text-xs text-slate-600 mt-1.5">Need attention</p>
            </div>
            <div className="stat-card">
              <p
                className={`text-2xl font-display ${
                  reportOverview.readyForExport ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {reportOverview.readyForExport ? "Ready" : "Blocked"}
              </p>
              <p className="text-xs text-slate-600 mt-1.5">Export status</p>
            </div>
          </div>

          <div
            className={`rounded-2xl border px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${
              reportOverview.readyForExport
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            }`}
          >
            <div className="space-y-1">
              <p
                className={`text-sm font-semibold ${
                  reportOverview.readyForExport ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                {reportOverview.readyForExport
                  ? "This day is ready for reporting and export."
                  : "This report still needs review before you can trust it."}
              </p>
              <p
                className={`text-sm ${
                  reportOverview.readyForExport ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {reportOverview.readyForExport
                  ? `${includedItems} approved item${includedItems !== 1 ? "s" : ""} are included below.`
                  : `${reportOverview.unresolvedCount} item${reportOverview.unresolvedCount !== 1 ? "s" : ""} still need attention before this day is ready to export.`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => navigate("/review")} className="btn-ghost text-xs">
                Open Review
              </button>
              <button onClick={() => navigate("/timesheets")} className="btn-primary text-xs">
                Open Timesheets
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] gap-4 items-start">
            <div className="space-y-4">
              <section className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Where time went</h3>
                    <p className="text-sm text-slate-600">
                      Included time from tracking and manual entries, excluding anything you marked out.
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>Tracked: {formatHours(reportOverview.trackedSeconds)}</p>
                    <p>Manual: {formatHours(reportOverview.manualSeconds)}</p>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  {reportOverview.categoryBreakdown.map((entry) => {
                    const color =
                      CATEGORY_COLORS[entry.category as Category] ?? CATEGORY_COLORS.unknown;
                    const widthPct =
                      reportOverview.loggedSeconds > 0
                        ? (entry.seconds / reportOverview.loggedSeconds) * 100
                        : 0;

                    return (
                      <div key={entry.category} className="flex items-center gap-2">
                        <span className="text-xs w-20 sm:w-24 text-slate-700 truncate">
                          {CATEGORY_LABELS[entry.category as Category] ?? entry.category}
                        </span>
                        <div className="flex-1 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: color,
                              boxShadow: `0 0 6px ${color}40`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 w-12 text-right font-data">
                          {entry.hours.toFixed(1)}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Project breakdown</h3>
                    <p className="text-sm text-slate-600">
                      {reportOverview.readyForExport
                        ? "Billable and non-billable time grouped the way it will export."
                        : "Current grouping before final review. Items that still need attention can still move."}
                    </p>
                  </div>
                  <button onClick={exportProjectsCsv} className="btn-ghost text-xs">
                    Export Project Rollup
                  </button>
                </div>
                <div className="space-y-2 mt-4">
                  {reportOverview.projectBreakdown.map((project) => {
                    const widthPct =
                      reportOverview.loggedSeconds > 0
                        ? (project.seconds / reportOverview.loggedSeconds) * 100
                        : 0;

                    return (
                      <div key={project.project} className="flex items-center gap-2">
                        <span className="text-xs w-24 sm:w-32 text-slate-700 truncate">
                          {project.project}
                        </span>
                        <div className="flex-1 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: project.billable ? "#2563eb" : "#94a3b8",
                              boxShadow: project.billable
                                ? "0 0 6px rgba(37, 99, 235, 0.28)"
                                : "none",
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] rounded-full px-2 py-0.5 ${
                              project.billable
                                ? "bg-emerald-500/12 text-emerald-700"
                                : "bg-slate-500/10 text-slate-600"
                            }`}
                          >
                            {project.billable ? "Billable" : "Internal"}
                          </span>
                          <span className="text-xs text-slate-600 w-12 text-right font-data">
                            {project.hours.toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <h3 className="text-base font-semibold text-slate-900">Reporting health</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Check whether this day is complete enough to trust in a report or export.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Coverage</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {leakage.coveragePct.toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Largest gap</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {leakage.gaps[0] ? formatGapDuration(leakage.gaps[0].seconds) : "0m"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Approved items</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {reportOverview.counts.approved}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface)] p-3">
                    <p className="text-slate-500">Excluded items</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {reportOverview.counts.excluded}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Suggested</span>
                    <span className="font-medium text-slate-900">{reportOverview.counts.suggested}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Needs review</span>
                    <span className="font-medium text-slate-900">{reportOverview.counts.needs_review}</span>
                  </div>
                </div>
              </section>

              <section className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">AI summary</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Optional narrative for the selected day.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    className="btn-ghost text-xs"
                  >
                    {generatingSummary
                      ? "Generating..."
                      : summary
                        ? "Regenerate"
                        : "Generate"}
                  </button>
                </div>
                {summary ? (
                  <>
                    <p className="text-sm text-slate-700 mt-4 leading-relaxed">{summary.summary}</p>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                      <div className="rounded-xl bg-[var(--color-surface)] p-3">
                        <p className="text-slate-500">Top project</p>
                        <p className="font-medium text-slate-900 mt-1">
                          {summary.top_project || "Various"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--color-surface)] p-3">
                        <p className="text-slate-500">Top category</p>
                        <p className="font-medium text-slate-900 mt-1">
                          {summary.top_category}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 mt-4">
                    Generate a short narrative after you have enough activity to summarize.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
