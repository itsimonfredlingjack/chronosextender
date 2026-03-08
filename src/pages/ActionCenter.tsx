import { useState, useEffect, useMemo } from "react";
import { useEvents } from "../hooks/useEvents";
import { api } from "../lib/tauri";
import type { Event } from "../lib/types";
import DayProgress from "../components/DayProgress";
import CategoryTiles from "../components/CategoryTiles";
import CategoryPieChart from "../components/CategoryPieChart";
import PendingBlockCard from "../components/PendingBlockCard";

function groupByApp(events: Event[]): { appName: string; events: Event[] }[] {
  const map = new Map<string, Event[]>();
  for (const e of events) {
    const existing = map.get(e.app_name);
    if (existing) {
      existing.push(e);
    } else {
      map.set(e.app_name, [e]);
    }
  }
  return [...map.entries()]
    .map(([appName, events]) => ({ appName, events }))
    .sort((a, b) => b.events.length - a.events.length);
}

export default function ActionCenter() {
  const { events } = useEvents();
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  const loadPending = async () => {
    try {
      const data = await api.getPendingEvents();
      setPendingEvents(data);
    } catch (e) {
      console.error("Failed to load pending events:", e);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);
  const pendingGroups = useMemo(() => groupByApp(pendingEvents), [pendingEvents]);

  const handleClassify = async (
    eventIds: number[],
    category: string,
    project: string | null
  ) => {
    for (const id of eventIds) {
      await api.reclassifyEvent(id, project, category, null);
    }
    setPendingEvents((prev) => prev.filter((e) => !eventIds.includes(e.id)));
  };

  const handleCreateRule = async (appName: string, category: string) => {
    try {
      await api.addRule({
        priority: 100,
        match_type: "app_name",
        match_value: appName,
        target_category: category,
        target_project_id: null,
      });
    } catch (e) {
      console.error("Failed to create rule:", e);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left — Insights */}
      <div className="w-3/5 p-6 space-y-6 overflow-auto">
        <div className="animate-[fade-in_0.3s_ease-out_backwards]" style={{ animationDelay: "0s" }}>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Action Center</h2>
          <p className="text-sm text-slate-600">Insights & unconfirmed time</p>
        </div>

        <div className="animate-[fade-in_0.3s_ease-out_backwards]" style={{ animationDelay: "0.05s" }}>
          <DayProgress totalSeconds={totalSeconds} />
        </div>

        <div className="animate-[fade-in_0.3s_ease-out_backwards]" style={{ animationDelay: "0.1s" }}>
          <CategoryTiles events={events} />
        </div>

        <div className="bg-[#fcfaf5] rounded-xl p-5 border border-[#d7d0c3] card-elevated animate-[fade-in_0.3s_ease-out_backwards]" style={{ animationDelay: "0.15s" }}>
          <CategoryPieChart events={events} />
        </div>
      </div>

      {/* Right — Action Feed */}
      <div className="w-2/5 p-6 border-l border-[#d7d0c3] overflow-auto bg-[#f2efe7]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Action Feed</h3>
            <p className="text-xs text-slate-600">
              {pendingEvents.length} pending event{pendingEvents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={loadPending} className="btn-ghost text-xs">
            Refresh
          </button>
        </div>

        {loadingPending ? (
          <div className="space-y-3">
            <div className="h-28 bg-[#fcfaf5] rounded-lg animate-pulse" />
            <div className="h-28 bg-[#fcfaf5] rounded-lg animate-pulse" />
            <div className="h-28 bg-[#fcfaf5] rounded-lg animate-pulse" />
          </div>
        ) : pendingGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl mb-2 text-slate-500">All caught up!</p>
            <p className="text-xs text-slate-600 mt-1">
              No pending events to review
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingGroups.map((group) => (
              <PendingBlockCard
                key={group.appName}
                events={group.events}
                appName={group.appName}
                onClassify={handleClassify}
                onCreateRule={handleCreateRule}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
