import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/tauri";
import type { Event } from "../lib/types";

export function useEvents(date?: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const data = date
        ? await api.getTimeline(date)
        : await api.getTodayEvents();
      setEvents(data);
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch events:", e);
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}
