import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MissionTimeline from "../../src/components/MissionTimeline";
import { buildMissionTimeline } from "../../src/lib/missionTimeline";
import type { Event } from "../../src/lib/types";

function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: 1,
    start_time: "2026-03-08T08:00:00.000Z",
    end_time: "2026-03-08T08:30:00.000Z",
    app_bundle_id: "com.example.app",
    app_name: "Example",
    window_title: "Window",
    browser_url: null,
    duration_seconds: 1800,
    category: "coding",
    project: "Chronos",
    task_description: null,
    confidence: 0.9,
    classification_source: "rule",
    created_at: "2026-03-08T08:00:00.000Z",
    ...overrides,
  };
}

test("buildMissionTimeline derives mixed tracked/untracked/flow segments", () => {
  const events = [
    makeEvent({
      id: 1,
      start_time: "2026-03-08T08:15:00.000Z",
      end_time: "2026-03-08T08:45:00.000Z",
      duration_seconds: 1800,
    }),
    makeEvent({
      id: 2,
      start_time: "2026-03-08T09:00:00.000Z",
      end_time: null,
      duration_seconds: 3000,
    }),
  ];

  const timeline = buildMissionTimeline({
    events,
    trackingActive: true,
    flowStatus: {
      in_flow: true,
      current_app: "Example",
      duration_minutes: 30,
      flow_start: "2026-03-08T09:30:00.000Z",
    },
    now: new Date("2026-03-08T10:00:00.000Z"),
    rangeStart: new Date("2026-03-08T08:00:00.000Z"),
  });

  const types = timeline.segments.map((segment) => segment.type);
  assert.deepEqual(types, ["untracked", "tracked", "untracked", "tracked", "flow"]);
  assert.equal(timeline.totals.trackedSeconds, 3600);
  assert.equal(timeline.totals.flowSeconds, 1800);
  assert.equal(timeline.totals.untrackedSeconds, 1800);
});

test("buildMissionTimeline uses paused segment when no events and tracking paused", () => {
  const timeline = buildMissionTimeline({
    events: [],
    trackingActive: false,
    flowStatus: null,
    now: new Date("2026-03-08T12:00:00.000Z"),
    rangeStart: new Date("2026-03-08T08:00:00.000Z"),
  });

  assert.equal(timeline.segments.length, 1);
  assert.equal(timeline.segments[0]?.type, "paused");
  assert.equal(timeline.totals.pausedSeconds, 4 * 3600);
});

test("MissionTimeline renders fallback copy when visual state is unknown", () => {
  const html = renderToStaticMarkup(
    <MissionTimeline
      visualState="unknown"
      statusLabel="Status unavailable"
      segments={[
        { type: "untracked", startPct: 0, endPct: 100, durationSeconds: 3600 },
      ]}
      totals={{
        trackedSeconds: 0,
        flowSeconds: 0,
        untrackedSeconds: 3600,
        pausedSeconds: 0,
      }}
      playheadPct={100}
    />
  );

  assert.match(html, /Status unavailable/);
  assert.match(html, /Mission timeline/i);
});

test("MissionTimeline preserves light-shell class contract", () => {
  const html = renderToStaticMarkup(
    <MissionTimeline
      visualState="normal"
      statusLabel="All systems normal"
      segments={[
        { type: "tracked", startPct: 0, endPct: 100, durationSeconds: 3600 },
      ]}
      totals={{
        trackedSeconds: 3600,
        flowSeconds: 0,
        untrackedSeconds: 0,
        pausedSeconds: 0,
      }}
      playheadPct={100}
    />
  );

  assert.match(html, /mission-timeline-shell/);
});
