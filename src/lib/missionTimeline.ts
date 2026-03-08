import type { Event, FlowStatus, TimelineSegment, TimelineSegmentType } from "./types";

interface BuildMissionTimelineInput {
  events: Event[];
  trackingActive: boolean;
  flowStatus: Pick<FlowStatus, "in_flow" | "flow_start"> | null;
  now?: Date;
  rangeStart?: Date;
}

interface TimelineTotals {
  trackedSeconds: number;
  flowSeconds: number;
  untrackedSeconds: number;
  pausedSeconds: number;
}

export interface MissionTimelineModel {
  segments: TimelineSegment[];
  totals: TimelineTotals;
  playheadPct: number;
}

interface TimelineSpan {
  type: TimelineSegmentType;
  startMs: number;
  endMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toStartOfDay(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function toMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function addTimelineSpan(spans: TimelineSpan[], next: TimelineSpan) {
  if (next.endMs <= next.startMs) {
    return;
  }

  const previous = spans[spans.length - 1];
  if (
    previous &&
    previous.type === next.type &&
    Math.abs(previous.endMs - next.startMs) < 1000
  ) {
    previous.endMs = next.endMs;
    return;
  }

  spans.push(next);
}

export function buildMissionTimeline({
  events,
  trackingActive,
  flowStatus,
  now = new Date(),
  rangeStart = toStartOfDay(now),
}: BuildMissionTimelineInput): MissionTimelineModel {
  const rangeStartMs = rangeStart.getTime();
  const nowMs = now.getTime();
  const rangeEndMs = Math.max(rangeStartMs + 60_000, nowMs);
  const totalRangeMs = rangeEndMs - rangeStartMs;

  const normalizedEvents = events
    .map((event) => {
      const startMsRaw = toMs(event.start_time);
      if (!startMsRaw) return null;

      const rawEndMs = toMs(event.end_time) ?? nowMs;
      const startMs = clamp(startMsRaw, rangeStartMs, rangeEndMs);
      const endMs = clamp(rawEndMs, rangeStartMs, rangeEndMs);
      if (endMs <= startMs) return null;

      return {
        startMs,
        endMs,
        active: event.end_time === null,
      };
    })
    .filter((event): event is { startMs: number; endMs: number; active: boolean } => event !== null)
    .sort((a, b) => a.startMs - b.startMs);

  const activeEvent = normalizedEvents.find((event) => event.active) ?? null;
  const flowStartMsRaw = flowStatus?.in_flow
    ? toMs(flowStatus.flow_start) ?? activeEvent?.startMs ?? nowMs
    : null;
  const flowStartMs = flowStartMsRaw ? clamp(flowStartMsRaw, rangeStartMs, rangeEndMs) : null;

  const trackedSpans: TimelineSpan[] = [];
  for (const event of normalizedEvents) {
    if (flowStartMs !== null && event.endMs > flowStartMs) {
      if (event.startMs < flowStartMs) {
        addTimelineSpan(trackedSpans, {
          type: "tracked",
          startMs: event.startMs,
          endMs: flowStartMs,
        });
      }

      addTimelineSpan(trackedSpans, {
        type: flowStatus?.in_flow ? "flow" : "tracked",
        startMs: Math.max(event.startMs, flowStartMs),
        endMs: event.endMs,
      });
      continue;
    }

    addTimelineSpan(trackedSpans, {
      type: "tracked",
      startMs: event.startMs,
      endMs: event.endMs,
    });
  }

  const pausedFromMs = trackingActive
    ? null
    : trackedSpans.length === 0
      ? rangeStartMs
      : trackedSpans[trackedSpans.length - 1]?.endMs ?? rangeStartMs;

  const timelineSpans: TimelineSpan[] = [];
  const pushGap = (startMs: number, endMs: number) => {
    if (endMs <= startMs) return;

    if (pausedFromMs !== null && endMs > pausedFromMs) {
      if (startMs < pausedFromMs) {
        addTimelineSpan(timelineSpans, {
          type: "untracked",
          startMs,
          endMs: pausedFromMs,
        });
      }
      addTimelineSpan(timelineSpans, {
        type: "paused",
        startMs: Math.max(startMs, pausedFromMs),
        endMs,
      });
      return;
    }

    addTimelineSpan(timelineSpans, {
      type: "untracked",
      startMs,
      endMs,
    });
  };

  let cursor = rangeStartMs;
  for (const span of trackedSpans) {
    const startMs = Math.max(span.startMs, cursor);
    if (startMs > cursor) {
      pushGap(cursor, startMs);
    }

    if (span.endMs <= startMs) continue;

    addTimelineSpan(timelineSpans, {
      type: span.type,
      startMs,
      endMs: span.endMs,
    });
    cursor = span.endMs;
  }

  if (cursor < rangeEndMs) {
    pushGap(cursor, rangeEndMs);
  }

  if (timelineSpans.length === 0) {
    addTimelineSpan(timelineSpans, {
      type: trackingActive ? "untracked" : "paused",
      startMs: rangeStartMs,
      endMs: rangeEndMs,
    });
  }

  const totals: TimelineTotals = {
    trackedSeconds: 0,
    flowSeconds: 0,
    untrackedSeconds: 0,
    pausedSeconds: 0,
  };

  const segments: TimelineSegment[] = timelineSpans.map((span) => {
    const durationSeconds = Math.max(1, Math.round((span.endMs - span.startMs) / 1000));
    const startPct = ((span.startMs - rangeStartMs) / totalRangeMs) * 100;
    const endPct = ((span.endMs - rangeStartMs) / totalRangeMs) * 100;

    if (span.type === "tracked") totals.trackedSeconds += durationSeconds;
    if (span.type === "flow") totals.flowSeconds += durationSeconds;
    if (span.type === "untracked") totals.untrackedSeconds += durationSeconds;
    if (span.type === "paused") totals.pausedSeconds += durationSeconds;

    return {
      type: span.type,
      startPct,
      endPct,
      durationSeconds,
    };
  });

  return {
    segments,
    totals,
    playheadPct: 100,
  };
}
