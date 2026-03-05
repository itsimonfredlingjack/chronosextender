import type { Event, Session, Category } from "./types";

const MAX_GAP_SECONDS = 120;

export function aggregateToSessions(events: Event[]): Session[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const sessions: Session[] = [];
  let current: Session = startSession(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    const eventCategory = event.category || "unknown";
    const gap = getGapSeconds(current.end_time, event.start_time);

    if (eventCategory === current.category && gap <= MAX_GAP_SECONDS) {
      // Merge into current session
      current.events.push(event);
      current.end_time = event.end_time || event.start_time;
      current.duration_seconds += event.duration_seconds;
      if (!current.apps.includes(event.app_name)) {
        current.apps.push(event.app_name);
      }
      if (event.project && !current.project) {
        current.project = event.project;
      }
    } else {
      sessions.push(current);
      current = startSession(event);
    }
  }

  sessions.push(current);
  return sessions;
}

function startSession(event: Event): Session {
  return {
    category: (event.category || "unknown") as Category,
    apps: [event.app_name],
    start_time: event.start_time,
    end_time: event.end_time || event.start_time,
    duration_seconds: event.duration_seconds,
    project: event.project,
    events: [event],
  };
}

function getGapSeconds(endTime: string, startTime: string): number {
  return (new Date(startTime).getTime() - new Date(endTime).getTime()) / 1000;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
