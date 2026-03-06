import type { Event } from "./types";

export interface LeakageStats {
  trackedSeconds: number;
  gapSeconds: number;
  coveragePct: number;
  gaps: { start: string; end: string; seconds: number }[];
  workdaySeconds: number;
}

export function computeLeakage(events: Event[]): LeakageStats {
  if (events.length === 0) {
    return { trackedSeconds: 0, gapSeconds: 0, coveragePct: 0, gaps: [], workdaySeconds: 0 };
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const firstStart = new Date(sorted[0].start_time).getTime();

  // If the last event has no end_time, it's still active — use now
  const lastEvent = sorted[sorted.length - 1];
  const lastEnd = lastEvent.end_time
    ? new Date(lastEvent.end_time).getTime()
    : Date.now();

  const workdaySeconds = Math.max(0, (lastEnd - firstStart) / 1000);
  const trackedSeconds = sorted.reduce((sum, e) => sum + e.duration_seconds, 0);

  const gaps: { start: string; end: string; seconds: number }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = sorted[i].end_time
      ? new Date(sorted[i].end_time!).getTime()
      : new Date(sorted[i].start_time).getTime() + sorted[i].duration_seconds * 1000;
    const nextStart = new Date(sorted[i + 1].start_time).getTime();
    const gapMs = nextStart - currentEnd;

    if (gapMs > 60_000) {
      gaps.push({
        start: new Date(currentEnd).toISOString(),
        end: new Date(nextStart).toISOString(),
        seconds: Math.round(gapMs / 1000),
      });
    }
  }

  const gapSeconds = gaps.reduce((sum, g) => sum + g.seconds, 0);
  const coveragePct = workdaySeconds > 0 ? (trackedSeconds / workdaySeconds) * 100 : 0;

  return { trackedSeconds, gapSeconds, coveragePct, gaps, workdaySeconds };
}

export function formatGapDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
