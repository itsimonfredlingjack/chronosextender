import { useState, useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/tauri";
import { aggregateToSessions } from "../lib/sessions";
import type { Event, Session, FlowStatus } from "../lib/types";

export function useOverlayData() {
  const [events, setEvents] = useState<Event[]>([]);
  const [flowStatus, setFlowStatus] = useState<FlowStatus>({
    in_flow: false,
    current_app: null,
    duration_minutes: 0,
    flow_start: null,
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [trackingActive, setTrackingActive] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [evts, flow, pending, active] = await Promise.all([
          api.getTodayEvents(),
          api.getFlowStatus(),
          api.getPendingCount(),
          api.getTrackingActive(),
        ]);
        if (!cancelled) {
          setEvents(evts);
          setFlowStatus(flow);
          setPendingCount(pending);
          setTrackingActive(active);
        }
      } catch (e) {
        console.error("Overlay data fetch failed:", e);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 3000);

    const unlistenWindow = listen("window-changed", () => fetchAll());
    const unlistenEvents = listen("events-changed", () => fetchAll());
    const unlistenFlow = listen<boolean>("flow-state-changed", (event) => {
      setFlowStatus((prev) => ({ ...prev, in_flow: event.payload }));
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      unlistenWindow.then((fn) => fn());
      unlistenEvents.then((fn) => fn());
      unlistenFlow.then((fn) => fn());
    };
  }, []);

  const sessions = useMemo(() => aggregateToSessions(events), [events]);

  const currentSession: Session | null = useMemo(() => {
    if (sessions.length === 0) return null;
    const last = sessions[sessions.length - 1];
    const lastEvent = last.events[last.events.length - 1];
    if (!lastEvent.end_time) return last;
    return null;
  }, [sessions]);

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);

  return {
    events,
    currentSession,
    flowStatus,
    pendingCount,
    trackingActive,
    totalSeconds,
  };
}
