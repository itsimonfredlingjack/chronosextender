import assert from "node:assert/strict";
import test from "node:test";

import type { Event, ManualTimeEntry, Project } from "../../src/lib/types";
import { buildReportOverview } from "../../src/lib/reports";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 1,
    start_time: "2026-03-09T08:00:00.000Z",
    end_time: "2026-03-09T09:00:00.000Z",
    app_bundle_id: "dev.chronos.test",
    app_name: "Code",
    window_title: "Chronos",
    browser_url: null,
    duration_seconds: 3600,
    category: "coding",
    project: "Chronos",
    task_description: "Core work",
    confidence: 0.95,
    classification_source: "rule",
    timesheet_status: "approved",
    approved_at: "2026-03-09T09:00:00.000Z",
    created_at: "2026-03-09T08:00:00.000Z",
    ...overrides,
  };
}

function makeManualEntry(
  overrides: Partial<ManualTimeEntry> = {}
): ManualTimeEntry {
  return {
    id: 1,
    entry_date: "2026-03-09",
    duration_seconds: 1800,
    project: "Client Ops",
    category: "communication",
    task_description: "Client check-in",
    source: "manual",
    timesheet_status: "approved",
    approved_at: "2026-03-09T11:00:00.000Z",
    created_at: "2026-03-09T11:00:00.000Z",
    updated_at: "2026-03-09T11:00:00.000Z",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "Chronos",
    client: null,
    hourly_rate: 150,
    color: "#6366f1",
    is_billable: false,
    created_at: "2026-03-09T00:00:00.000Z",
    ...overrides,
  };
}

test("buildReportOverview includes manual time, excludes excluded items, and groups project/category totals", () => {
  const overview = buildReportOverview({
    events: [
      makeEvent({
        id: 1,
        duration_seconds: 3600,
        project: "Chronos",
        category: "coding",
        timesheet_status: "approved",
      }),
      makeEvent({
        id: 2,
        duration_seconds: 1800,
        project: "Client Ops",
        category: "communication",
        timesheet_status: "suggested",
        approved_at: null,
      }),
      makeEvent({
        id: 3,
        duration_seconds: 1200,
        project: "Chronos",
        category: "documentation",
        timesheet_status: "excluded",
        approved_at: null,
      }),
    ],
    manualEntries: [
      makeManualEntry({
        id: 11,
        duration_seconds: 900,
        project: "Client Ops",
        category: "communication",
        timesheet_status: "needs_review",
        approved_at: null,
      }),
      makeManualEntry({
        id: 12,
        duration_seconds: 600,
        project: "Internal",
        category: "admin",
        timesheet_status: "excluded",
        approved_at: null,
      }),
    ],
    projects: [
      makeProject(),
      makeProject({ id: 2, name: "Client Ops", is_billable: true }),
      makeProject({ id: 3, name: "Internal", is_billable: false }),
    ],
  });

  assert.equal(overview.trackedSeconds, 5400);
  assert.equal(overview.manualSeconds, 900);
  assert.equal(overview.loggedSeconds, 6300);
  assert.equal(overview.unresolvedCount, 2);
  assert.equal(overview.readyForExport, false);
  assert.equal(overview.billableHours, 0.75);
  assert.deepEqual(overview.counts, {
    suggested: 1,
    needs_review: 1,
    approved: 1,
    excluded: 2,
  });
  assert.deepEqual(overview.projectBreakdown, [
    { project: "Chronos", seconds: 3600, hours: 1, billable: false },
    { project: "Client Ops", seconds: 2700, hours: 0.75, billable: true },
  ]);
  assert.deepEqual(overview.categoryBreakdown, [
    { category: "coding", seconds: 3600, hours: 1 },
    { category: "communication", seconds: 2700, hours: 0.75 },
  ]);
});

test("buildReportOverview turns ready once only approved or excluded items remain", () => {
  const overview = buildReportOverview({
    events: [
      makeEvent({ timesheet_status: "approved" }),
      makeEvent({ id: 2, timesheet_status: "excluded", approved_at: null }),
    ],
    manualEntries: [
      makeManualEntry({ timesheet_status: "approved" }),
    ],
    projects: [
      makeProject(),
      makeProject({ id: 2, name: "Client Ops", is_billable: true }),
    ],
  });

  assert.equal(overview.readyForExport, true);
  assert.equal(overview.unresolvedCount, 0);
  assert.equal(overview.loggedSeconds, 5400);
  assert.equal(overview.billableHours, 0.5);
});
