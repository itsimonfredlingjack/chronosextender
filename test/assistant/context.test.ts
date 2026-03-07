import assert from "node:assert/strict";
import test from "node:test";

import { buildAssistantContext } from "../../src/lib/ai/context";
import type { AssistantContextSnapshot } from "../../src/types/ai-types";

test("buildAssistantContext formats current view, summary, and recent entries", () => {
  const snapshot: AssistantContextSnapshot = {
    current_date: "2026-03-06",
    today_total_seconds: 22500,
    week_total_seconds: 111600,
    today_event_count: 3,
    pending_count: 2,
    current_flow_minutes: 45,
    top_projects: [
      { project: "Chronos", seconds: 18000 },
      { project: "Client X", seconds: 7200 },
    ],
    recent_events: [
      {
        start_time: "2026-03-06T09:00:00",
        end_time: "2026-03-06T11:30:00",
        project: "Chronos",
        category: "coding",
        app_name: "Cursor",
        task_description: "AI panel",
      },
    ],
    recent_summaries: [
      {
        date: "2026-03-06",
        total_hours: 6.25,
        top_category: "coding",
        top_project: "Chronos",
        summary: "Focused build day",
        productivity_score: 8.9,
      },
    ],
  };

  const output = buildAssistantContext({
    currentView: "dashboard",
    snapshot,
  });

  assert.match(output, /<app_context>/);
  assert.match(output, /<current_view>dashboard<\/current_view>/);
  assert.match(output, /Total tracked: 6h 15m today/);
  assert.match(output, /Most active this week: Chronos/);
  assert.match(output, /Project: Chronos/);
  assert.match(output, /AI panel \[coding\]/);
});

test("buildAssistantContext trims long entry lists to stay compact", () => {
  const output = buildAssistantContext({
    currentView: "reports",
    snapshot: {
      current_date: "2026-03-06",
      today_total_seconds: 3600,
      week_total_seconds: 7200,
      today_event_count: 20,
      pending_count: 0,
      current_flow_minutes: 0,
      top_projects: [],
      recent_summaries: [],
      recent_events: Array.from({ length: 12 }, (_, index) => ({
        start_time: `2026-03-06T0${index % 9}:00:00`,
        end_time: `2026-03-06T0${index % 9}:30:00`,
        project: null,
        category: "unknown",
        app_name: `App ${index}`,
        task_description: null,
      })),
    },
  });

  const entryCount = (output.match(/^- /gm) ?? []).length;
  assert.equal(entryCount, 6);
});
