import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateToReviewWorkBlocks,
  isEventPendingReview,
} from "../../src/lib/workblocks";
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

test("isEventPendingReview matches unresolved review semantics", () => {
  assert.equal(
    isEventPendingReview(
      makeEvent({
        classification_source: "pending",
        confidence: 0.9,
      })
    ),
    true
  );
  assert.equal(
    isEventPendingReview(
      makeEvent({
        classification_source: "llm",
        confidence: 0.4,
      })
    ),
    true
  );
  assert.equal(
    isEventPendingReview(
      makeEvent({
        classification_source: "rule",
        confidence: 0.9,
        timesheet_status: "suggested",
      })
    ),
    true
  );
  assert.equal(
    isEventPendingReview(
      makeEvent({
        classification_source: "manual",
        confidence: 1,
        timesheet_status: "approved",
      })
    ),
    false
  );
});

test("aggregateToReviewWorkBlocks excludes already approved events", () => {
  const blocks = aggregateToReviewWorkBlocks([
    makeEvent({
      id: 1,
      start_time: "2026-03-08T08:00:00.000Z",
      end_time: "2026-03-08T08:30:00.000Z",
      classification_source: "manual",
      confidence: 1,
      timesheet_status: "approved",
    }),
    makeEvent({
      id: 2,
      start_time: "2026-03-08T09:00:00.000Z",
      end_time: "2026-03-08T09:30:00.000Z",
      classification_source: "rule",
      confidence: 0.9,
      timesheet_status: "suggested",
    }),
  ]);

  assert.equal(blocks.length, 1);
  assert.deepEqual(
    blocks[0]?.events.map((event) => event.id),
    [2]
  );
});
