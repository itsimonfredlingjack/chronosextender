import { useState, useEffect } from "react";
import { api } from "../lib/tauri";
import type { Event } from "../lib/types";

export function useEvents(date?: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchEvents = async () => {
      try {
        const data = date
          ? await api.getTimeline(date)
          : await api.getTodayEvents();
        if (!cancelled) {
          setEvents(data);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to fetch events:", e);
        if (!cancelled) setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [date]);

  return { events, loading };
}
