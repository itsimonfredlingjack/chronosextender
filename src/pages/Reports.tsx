import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays } from "date-fns";
import { useEvents } from "../hooks/useEvents";
import { api } from "../lib/tauri";
import type { Category, ProjectSummary, DailySummaryData } from "../lib/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "../lib/types";
import { computeLeakage } from "../lib/leakage";
import CategoryPieChart from "../components/CategoryPieChart";

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { events, loading } = useEvents(dateStr);
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
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 overflow-auto h-full">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Reports</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-[#1a1a2e] transition-colors"
            >
              {"\u2039"}
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                isToday
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-gray-400 hover:text-white hover:bg-[#1a1a2e]"
              }`}
            >
              {isToday ? "Today" : format(selectedDate, "MMM d")}
            </button>
            <button
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              disabled={isToday}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-[#1a1a2e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {"\u203A"}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-ghost text-xs">
            Export CSV
          </button>
          <button onClick={exportProjectCSV} className="btn-ghost text-xs">
            Project CSV
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-gray-400">No data for this date</p>
          <p className="text-xs text-gray-600 mt-1">
            {isToday ? "Start working to begin tracking" : "Try a different date"}
          </p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a40]">
              <p className="text-xs text-gray-500 mb-1">Total</p>
              <p className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {formatHours(totalSeconds)}
              </p>
            </div>
            <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a40]">
              <p className="text-xs text-gray-500 mb-1">Billable</p>
              <p className="text-xl font-bold text-emerald-400">
                {projectSummary
                  ? `${projectSummary.billable_hours.toFixed(1)}h`
                  : "\u2014"}
              </p>
            </div>
            <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a40]">
              <p className="text-xs text-gray-500 mb-1">Events</p>
              <p className="text-xl font-bold text-white">{events.length}</p>
            </div>
            <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a40]">
              <p className="text-xs text-gray-500 mb-1">Coverage</p>
              <p className="text-xl font-bold text-amber-400">
                {leakage.coveragePct.toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Category breakdown + pie */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-3 bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a40]">
              <h3 className="text-xs font-medium text-gray-400 mb-2">
                Categories
              </h3>
              <div className="space-y-1.5">
                {Object.entries(categoryMap)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, seconds]) => {
                    const color =
                      CATEGORY_COLORS[category as Category] ||
                      CATEGORY_COLORS.unknown;
                    return (
                      <div key={category} className="flex items-center gap-2">
                        <span className="text-xs w-20 text-gray-400 truncate">
                          {CATEGORY_LABELS[category as Category] || category}
                        </span>
                        <div className="flex-1 h-5 bg-[#12121e] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(seconds / totalSeconds) * 100}%`,
                              backgroundColor: color,
                              boxShadow: `0 0 6px ${color}40`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right tabular-nums">
                          {formatHours(seconds)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="col-span-2 bg-[#1a1a2e] rounded-lg p-3 border border-[#2a2a40]">
              <CategoryPieChart events={events} />
            </div>
          </div>

          {/* Project breakdown */}
          {projectSummary && projectSummary.projects.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a40]">
              <h3 className="text-xs font-medium text-gray-400 mb-2">
                Projects
              </h3>
              <div className="space-y-1.5">
                {projectSummary.projects
                  .sort((a, b) => b.hours - a.hours)
                  .map((proj) => (
                    <div key={proj.project} className="flex items-center gap-2">
                      <span className="text-xs w-24 text-gray-300 truncate">
                        {proj.project}
                      </span>
                      <div className="flex-1 h-5 bg-[#12121e] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(proj.hours / projectSummary.total_hours) * 100}%`,
                            backgroundColor: proj.billable
                              ? "#6366f1"
                              : "#4b5563",
                            boxShadow: proj.billable
                              ? "0 0 6px rgba(99, 102, 241, 0.3)"
                              : "none",
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {proj.billable && (
                          <span className="text-[10px] text-emerald-400">$</span>
                        )}
                        <span className="text-xs text-gray-500 w-12 text-right tabular-nums">
                          {proj.hours.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#2a2a40]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-400">AI Summary</h3>
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
                <p className="text-sm text-gray-300">{summary.summary}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>Score: {summary.productivity_score}/10</span>
                  <span>Top: {summary.top_category}</span>
                  {summary.top_project && summary.top_project !== "Various" && (
                    <span>Project: {summary.top_project}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                Click Generate for an AI summary of this day
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
