import { useState } from "react";
import { format } from "date-fns";
import { useEvents } from "../hooks/useEvents";
import type { Category } from "../lib/types";
import { CATEGORY_LABELS } from "../lib/types";

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

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  for (const event of events) {
    const cat = event.category || "unknown";
    categoryMap[cat] = (categoryMap[cat] || 0) + event.duration_seconds;
  }

  // Project breakdown
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Reports
        </h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Daily Report - {format(selectedDate, "MMM d, yyyy")}
        </h3>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Total Time
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatHours(totalSeconds)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Events Tracked
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {events.length}
            </p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Category Breakdown
        </h3>
        <div className="space-y-2">
          {Object.entries(categoryMap)
            .sort(([, a], [, b]) => b - a)
            .map(([category, seconds]) => (
              <div key={category} className="flex items-center gap-3">
                <span className="text-sm w-28 text-gray-700 dark:text-gray-300">
                  {CATEGORY_LABELS[category as Category] || category}
                </span>
                <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{
                      width: `${(seconds / totalSeconds) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 w-16 text-right">
                  {formatHours(seconds)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Project Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Project Breakdown
        </h3>
        <div className="space-y-2">
          {Object.entries(projectMap)
            .sort(([, a], [, b]) => b - a)
            .map(([project, seconds]) => (
              <div key={project} className="flex items-center gap-3">
                <span className="text-sm w-28 text-gray-700 dark:text-gray-300 truncate">
                  {project}
                </span>
                <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${(seconds / totalSeconds) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 w-16 text-right">
                  {formatHours(seconds)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
