import { useEvents } from "../hooks/useEvents";
import { useFlowState } from "../hooks/useFlowState";
import FlowOrb from "../components/FlowOrb";
import CategoryPieChart from "../components/CategoryPieChart";
import EventCard from "../components/EventCard";
import TimelineBar from "../components/TimelineBar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Dashboard() {
  const { events, loading } = useEvents();
  const flowStatus = useFlowState();

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);
  const currentEvent = events.find((e) => !e.end_time);
  const recentEvents = [...events].reverse().slice(0, 8);

  // Project breakdown for bar chart
  const projectMap: Record<string, number> = {};
  for (const event of events) {
    const proj = event.project || "Unclassified";
    projectMap[proj] = (projectMap[proj] || 0) + event.duration_seconds;
  }
  const projectData = Object.entries(projectMap)
    .map(([name, seconds]) => ({
      name,
      hours: Math.round((seconds / 3600) * 100) / 100,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <FlowOrb flowStatus={flowStatus} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Today
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatHours(totalSeconds)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Events</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {events.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current Activity
          </p>
          {currentEvent ? (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentEvent.app_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {currentEvent.window_title || ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No active window</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Today's Timeline
        </h3>
        <TimelineBar events={events} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            By Category
          </h3>
          <CategoryPieChart events={events} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            By Project
          </h3>
          {projectData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={projectData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => [
                    `${value.toFixed(2)}h`,
                    "Hours",
                  ]}
                />
                <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Recent Activity
        </h3>
        <div className="space-y-2">
          {recentEvents.length > 0 ? (
            recentEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          ) : (
            <p className="text-sm text-gray-400">
              No events recorded yet. Start using your Mac!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
