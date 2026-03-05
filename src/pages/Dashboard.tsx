import { useMemo } from "react";
import { useEvents } from "../hooks/useEvents";
import { useFlowState } from "../hooks/useFlowState";
import NowHero from "../components/NowHero";
import TimelineBar from "../components/TimelineBar";
import RuleSuggestions from "../components/RuleSuggestions";
import { aggregateToSessions, formatDuration } from "../lib/sessions";
import type { Category } from "../lib/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "../lib/types";

export default function Dashboard() {
  const { events, loading } = useEvents();
  const flowStatus = useFlowState();

  const sessions = useMemo(() => aggregateToSessions(events), [events]);

  const currentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    const last = sessions[sessions.length - 1];
    const lastEvent = last.events[last.events.length - 1];
    if (!lastEvent.end_time) return last;
    return null;
  }, [sessions]);

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const cat = e.category || "unknown";
      map[cat] = (map[cat] || 0) + e.duration_seconds;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, seconds]) => ({
        category: cat as Category,
        label: CATEGORY_LABELS[cat as Category] || cat,
        duration: formatDuration(seconds),
      }));
  }, [events]);

  const recentSessions = useMemo(
    () => [...sessions].reverse().slice(0, 6),
    [sessions]
  );

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
      <div
        className="animate-[fade-in_0.3s_ease-out_backwards]"
        style={{ animationDelay: "0s" }}
      >
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

      {/* A. Now Hero */}
      <div
        className="animate-[fade-in_0.3s_ease-out_backwards]"
        style={{ animationDelay: "0.05s" }}
      >
        <NowHero currentSession={currentSession} flowStatus={flowStatus} />
      </div>

      {/* B. Big Timeline */}
      <div
        className="bg-white dark:bg-[#1a1a2e] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a40] gradient-border animate-[fade-in_0.3s_ease-out_backwards]"
        style={{ animationDelay: "0.1s" }}
      >
        <TimelineBar events={events} />
      </div>

      {/* C. Today's Stats */}
      <div
        className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-gray-600 dark:text-gray-300 animate-[fade-in_0.3s_ease-out_backwards]"
        style={{ animationDelay: "0.15s" }}
      >
        <span className="font-medium text-gray-900 dark:text-white">
          {formatDuration(totalSeconds)} tracked
        </span>
        {categoryTotals.map((ct) => (
          <span key={ct.category}>
            <span className="text-gray-400 dark:text-gray-500">·</span>{" "}
            {ct.duration} {ct.label.toLowerCase()}
          </span>
        ))}
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div
          className="bg-white dark:bg-[#1a1a2e] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a40] gradient-border animate-[fade-in_0.3s_ease-out_backwards]"
          style={{ animationDelay: "0.2s" }}
        >
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Recent Sessions
          </h3>
          <div className="space-y-2">
            {recentSessions.map((session, i) => {
              const color =
                CATEGORY_COLORS[session.category] || CATEGORY_COLORS.unknown;
              return (
                <div
                  key={`${session.start_time}-${i}`}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-[#2a2a40]/50 last:border-0"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 6px ${color}50`,
                    }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {CATEGORY_LABELS[session.category] || "Unknown"}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">
                    {session.apps.join(", ")}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                    {formatDuration(session.duration_seconds)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* D. Rule Suggestions */}
      <div
        className="animate-[fade-in_0.3s_ease-out_backwards]"
        style={{ animationDelay: "0.25s" }}
      >
        <RuleSuggestions />
      </div>
    </div>
  );
}
