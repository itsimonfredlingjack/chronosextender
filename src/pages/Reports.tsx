import { useState } from "react";
import { format } from "date-fns";
import { useEvents } from "../hooks/useEvents";
import type { Category } from "../lib/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "../lib/types";
import AIInsights from "../components/AIInsights";
import CategoryPieChart from "../components/CategoryPieChart";

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Reports() {
  const [selectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { events, loading } = useEvents(dateStr);

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);

  const categoryMap: Record<string, number> = {};
  for (const event of events) {
    const cat = event.category || "unknown";
    categoryMap[cat] = (categoryMap[cat] || 0) + event.duration_seconds;
  }

  const projectMap: Record<string, number> = {};
  for (const event of events) {
    const proj = event.project || "Unclassified";
    projectMap[proj] = (projectMap[proj] || 0) + event.duration_seconds;
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

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronos-report-${dateStr}.json`;
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
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Reports</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-ghost text-sm">Export CSV</button>
          <button onClick={exportJSON} className="btn-ghost text-sm">Export JSON</button>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="bg-[#1a1a2e] rounded-xl p-6 border border-[#2a2a40] gradient-border">
        <h3 className="text-lg font-medium text-white mb-4">
          Daily Report — {format(selectedDate, "MMM d, yyyy")}
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-400 mb-1">Total Time</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {formatHours(totalSeconds)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Events Tracked</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {events.length}
            </p>
          </div>
        </div>
      </div>

      <AIInsights events={events} />

      {/* Category Breakdown */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-[#1a1a2e] rounded-xl p-6 border border-[#2a2a40]">
          <h3 className="text-sm font-medium text-white mb-3">Category Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(categoryMap)
              .sort(([, a], [, b]) => b - a)
              .map(([category, seconds]) => {
                const color = CATEGORY_COLORS[category as Category] || CATEGORY_COLORS.unknown;
                return (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-sm w-28 text-gray-300">
                      {CATEGORY_LABELS[category as Category] || category}
                    </span>
                    <div className="flex-1 h-6 bg-[#12121e] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(seconds / totalSeconds) * 100}%`,
                          backgroundColor: color,
                          boxShadow: `0 0 8px ${color}40`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-16 text-right tabular-nums">
                      {formatHours(seconds)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="col-span-2 bg-[#1a1a2e] rounded-xl p-4 border border-[#2a2a40]">
          <CategoryPieChart events={events} />
        </div>
      </div>

      {/* Project Breakdown */}
      <div className="bg-[#1a1a2e] rounded-xl p-6 border border-[#2a2a40]">
        <h3 className="text-sm font-medium text-white mb-3">Project Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(projectMap)
            .sort(([, a], [, b]) => b - a)
            .map(([project, seconds]) => (
              <div key={project} className="flex items-center gap-3">
                <span className="text-sm w-28 text-gray-300 truncate">{project}</span>
                <div className="flex-1 h-6 bg-[#12121e] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(seconds / totalSeconds) * 100}%`,
                      backgroundColor: "#6366f1",
                      boxShadow: "0 0 8px rgba(99, 102, 241, 0.3)",
                    }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-16 text-right tabular-nums">
                  {formatHours(seconds)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
