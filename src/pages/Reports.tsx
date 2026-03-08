import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays } from "date-fns";
import { useEvents } from "../hooks/useEvents";
import { useCommandDeckState } from "../hooks/useCommandDeckState";
import { api } from "../lib/tauri";
import type { Category, ProjectSummary, DailySummaryData } from "../lib/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "../lib/types";
import { computeLeakage } from "../lib/leakage";
import CategoryPieChart from "../components/CategoryPieChart";
import PageTopStrip from "../components/PageTopStrip";

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { events, loading } = useEvents(dateStr);
  const { visualState, statusLabel } = useCommandDeckState();
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

  const leakage = useMemo(() => computeLeakage(events), [events]);

  useEffect(() => {
    api
      .getProjectSummary(dateStr, dateStr)
      .then(setProjectSummary)
      .catch(() => setProjectSummary(null));
    api
      .getDailySummary(dateStr)
      .then((s) => {
        if (s) {
          try {
            setSummary(JSON.parse(s.summary_json));
          } catch {
            setSummary(null);
          }
        } else {
          setSummary(null);
        }
      })
      .catch(() => setSummary(null));
  }, [dateStr]);

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
      // summary generation failed
    } finally {
      setGeneratingSummary(false);
    }
  };

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);

  const categoryMap: Record<string, number> = {};
  for (const event of events) {
    const cat = event.category || "unknown";
    categoryMap[cat] = (categoryMap[cat] || 0) + event.duration_seconds;
  }

  const exportCSV = () => {
    const header = "Start,End,App,Title,Category,Project,Duration (min)\n";
    const rows = events
      .map(
        (e) =>
          `${e.start_time},${e.end_time || ""},${e.app_name},"${(e.window_title || "").replace(/"/g, '""')}",${e.category || ""},${e.project || ""},${Math.round(e.duration_seconds / 60)}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronos-report-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportProjectCSV = () => {
    if (!projectSummary) return;
    const header = "Project,Hours,Billable\n";
    const rows = projectSummary.projects
      .sort((a, b) => b.hours - a.hours)
      .map((p) => `"${p.project}",${p.hours.toFixed(2)},${p.billable ? "Yes" : "No"}`)
      .join("\n");
    const footer = `\nTotal,${projectSummary.total_hours.toFixed(2)},\nBillable,${projectSummary.billable_hours.toFixed(2)},`;
    const blob = new Blob([header + rows + footer], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronos-projects-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-6 w-24 bg-[var(--color-card)] rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--color-card)] rounded-xl p-4 border border-[var(--color-border)] space-y-2">
              <div className="h-6 w-16 bg-[var(--color-elevated)] rounded" />
              <div className="h-3 w-10 bg-[var(--color-elevated)] rounded" />
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
        subtitle="Performance and output intelligence"
        visualState={visualState}
        statusLabel={statusLabel}
        rightSlot={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-lg p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setSelectedDate((d) => subDays(d, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)] transition-all"
              >
                {"\u2039"}
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${isToday
                    ? "bg-gradient-to-r from-indigo-500/14 to-blue-500/18 text-indigo-700 border border-indigo-500/25"
                    : "text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)]"
                  }`}
              >
                {isToday ? "Today" : format(selectedDate, "MMM d")}
              </button>
              <button
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                disabled={isToday}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-[var(--color-elevated)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {"\u203A"}
              </button>
            </div>
            <button onClick={exportCSV} className="btn-ghost text-xs">
              Export CSV
            </button>
            <button onClick={exportProjectCSV} className="btn-ghost text-xs">
              Project CSV
            </button>
          </div>
        )}
      />

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {/* Empty state illustration */}
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/12 to-blue-500/12 rotate-6" />
            <div className="absolute inset-0 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center">
              <span className="text-2xl text-slate-500">▤</span>
            </div>
          </div>
          <p className="text-sm text-slate-600 font-medium">No data for this date</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs">
            {isToday
              ? "Start working and Chronos will automatically track your activity"
              : "Navigate to a date with tracked activity, or use the AI to log past work"}
          </p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
            {/* Hero card — Total */}
            <div className="stat-card-hero">
              <p className="text-[1.75rem] leading-none font-display bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                {formatHours(totalSeconds)}
              </p>
              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5">
                <span className="text-base">⏱</span>
                Total tracked
              </p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">
                {projectSummary
                  ? `${projectSummary.billable_hours.toFixed(1)}h`
                  : "\u2014"}
              </p>
              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5">
                <span className="text-base">💰</span>
                Billable
              </p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">{events.length}</p>
              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5">
                <span className="text-base">📊</span>
                Events
              </p>
            </div>
            <div className="stat-card">
              <p className="text-2xl text-slate-900 font-display">
                {leakage.coveragePct.toFixed(0)}%
              </p>
              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5">
                <span className="text-base">🎯</span>
                Coverage
              </p>
            </div>
          </div>

          {/* Category breakdown + pie */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="lg:col-span-3 bg-[var(--color-card)] rounded-xl p-4 border border-[var(--color-border)]">
              <h3 className="text-xs font-medium text-slate-600 mb-3">
                Categories
              </h3>
              <div className="space-y-2">
                {Object.entries(categoryMap)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, seconds]) => {
                    const color =
                      CATEGORY_COLORS[category as Category] ||
                      CATEGORY_COLORS.unknown;
                    const pct = ((seconds / totalSeconds) * 100).toFixed(0);
                    return (
                      <div key={category} className="flex items-center gap-2">
                        <span className="text-xs w-16 sm:w-20 text-slate-600 truncate">
                          {CATEGORY_LABELS[category as Category] || category}
                        </span>
                        <div className="flex-1 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(seconds / totalSeconds) * 100}%`,
                              backgroundColor: color,
                              boxShadow: `0 0 6px ${color}40`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 w-8 text-right font-data">
                          {pct}%
                        </span>
                        <span className="text-xs text-slate-500 w-10 sm:w-12 text-right font-data">
                          {formatHours(seconds)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="lg:col-span-2 bg-[var(--color-card)] rounded-xl p-3 border border-[var(--color-border)]">
              <CategoryPieChart events={events} />
            </div>
          </div>

          {/* Project breakdown */}
          {projectSummary && projectSummary.projects.length > 0 && (
            <div className="bg-[var(--color-card)] rounded-xl p-4 border border-[var(--color-border)] animate-slide-up" style={{ animationDelay: "0.15s" }}>
              <h3 className="text-xs font-medium text-slate-600 mb-3">
                Projects
              </h3>
              <div className="space-y-2">
                {projectSummary.projects
                  .sort((a, b) => b.hours - a.hours)
                  .map((proj) => (
                    <div key={proj.project} className="flex items-center gap-2">
                      <span className="text-xs w-20 sm:w-24 text-slate-700 truncate">
                        {proj.project}
                      </span>
                      <div className="flex-1 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(proj.hours / projectSummary.total_hours) * 100}%`,
                            backgroundColor: proj.billable
                              ? "#6366f1"
                              : "#94a3b8",
                            boxShadow: proj.billable
                              ? "0 0 6px rgba(99, 102, 241, 0.3)"
                              : "none",
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {proj.billable && (
                          <span className="text-[10px] text-emerald-600">$</span>
                        )}
                        <span className="text-xs text-slate-600 w-12 text-right font-data">
                          {proj.hours.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="bg-[var(--color-card)] rounded-xl p-4 border border-[var(--color-border)] animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <span>✦</span> AI Summary
              </h3>
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
                <p className="text-sm text-slate-700 leading-relaxed">{summary.summary}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${summary.productivity_score >= 7
                        ? "bg-emerald-500/12 text-emerald-700"
                        : summary.productivity_score >= 5
                          ? "bg-amber-500/12 text-amber-700"
                          : "bg-red-500/12 text-red-700"
                      }`}
                  >
                    {summary.productivity_score}/10
                  </span>
                  <span>Top: {summary.top_category}</span>
                  {summary.top_project && summary.top_project !== "Various" && (
                    <span>Project: {summary.top_project}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Click Generate for an AI-powered summary of your workday
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
