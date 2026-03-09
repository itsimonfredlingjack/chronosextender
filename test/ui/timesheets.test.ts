import assert from "node:assert/strict";
import test from "node:test";

import type {
  Event,
  ManualTimeEntry,
  TimesheetExportReadiness,
  TimesheetRow,
  TimesheetStatus,
} from "../../src/lib/types";
import {
  aggregateApprovedTimesheetRows,
  buildTimesheetCsv,
  getTimesheetExportReadiness,
  resolveDefaultTimesheetStatus,
} from "../../src/lib/timesheets";

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
    task_description: "Core timesheet work",
    confidence: 0.95,
    classification_source: "rule",
    timesheet_status: "suggested",
    approved_at: null,
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
    project: "Chronos",
    category: "documentation",
    task_description: "Write release notes",
    source: "manual_nlp",
    timesheet_status: "needs_review",
    approved_at: null,
    created_at: "2026-03-09T12:00:00.000Z",
    updated_at: "2026-03-09T12:00:00.000Z",
    ...overrides,
  };
}

test("resolveDefaultTimesheetStatus marks high-confidence tracked work as suggested", () => {
  assert.equal(resolveDefaultTimesheetStatus(makeEvent()), "suggested");
});

test("resolveDefaultTimesheetStatus marks low-confidence or pending work as needs_review", () => {
  assert.equal(
    resolveDefaultTimesheetStatus(
      makeEvent({ confidence: 0.42, classification_source: "llm" })
    ),
    "needs_review"
  );
  assert.equal(
    resolveDefaultTimesheetStatus(
      makeEvent({ confidence: 0.95, classification_source: "pending" })
    ),
    "needs_review"
  );
});

test("aggregateApprovedTimesheetRows merges approved tracked work and manual entries into normalized rows", () => {
  const rows = aggregateApprovedTimesheetRows({
    events: [
      makeEvent({
        id: 1,
        duration_seconds: 1800,
        timesheet_status: "approved",
        approved_at: "2026-03-09T17:00:00.000Z",
      }),
      makeEvent({
        id: 2,
        start_time: "2026-03-09T09:00:00.000Z",
        end_time: "2026-03-09T09:30:00.000Z",
        duration_seconds: 1800,
        timesheet_status: "approved",
        approved_at: "2026-03-09T17:05:00.000Z",
      }),
      makeEvent({
        id: 3,
        start_time: "2026-03-09T10:00:00.000Z",
        end_time: "2026-03-09T10:30:00.000Z",
        duration_seconds: 1800,
        task_description: "Pair on command palette",
        timesheet_status: "approved",
        approved_at: "2026-03-09T17:10:00.000Z",
      }),
      makeEvent({
        id: 4,
        duration_seconds: 900,
        timesheet_status: "excluded",
      }),
    ],
    manualEntries: [
      makeManualEntry({
        id: 11,
        timesheet_status: "approved",
        approved_at: "2026-03-09T18:00:00.000Z",
      }),
      makeManualEntry({
        id: 12,
        task_description: "Write release notes",
        timesheet_status: "excluded",
      }),
    ],
  });

  const comparable = rows
    .map((row) => ({
      date: row.date,
      project: row.project,
      category: row.category,
      task: row.task_description,
      duration: row.duration_seconds,
      source: row.source,
    }))
    .sort((a, b) =>
      `${a.date}|${a.project}|${a.category}|${a.task}|${a.source}`.localeCompare(
        `${b.date}|${b.project}|${b.category}|${b.task}|${b.source}`
      )
    );

  assert.deepEqual(
    comparable,
    [
      {
        date: "2026-03-09",
        project: "Chronos",
        category: "coding",
        task: "Core timesheet work",
        duration: 3600,
        source: "tracked",
      },
      {
        date: "2026-03-09",
        project: "Chronos",
        category: "documentation",
        task: "Write release notes",
        duration: 1800,
        source: "manual_nlp",
      },
      {
        date: "2026-03-09",
        project: "Chronos",
        category: "coding",
        task: "Pair on command palette",
        duration: 1800,
        source: "tracked",
      },
    ].sort((a, b) =>
      `${a.date}|${a.project}|${a.category}|${a.task}|${a.source}`.localeCompare(
        `${b.date}|${b.project}|${b.category}|${b.task}|${b.source}`
      )
    )
  );
});

test("getTimesheetExportReadiness blocks export until only approved or excluded items remain", () => {
  const readiness: TimesheetExportReadiness = getTimesheetExportReadiness({
    events: [
      makeEvent({ timesheet_status: "approved" }),
      makeEvent({ id: 2, timesheet_status: "excluded" }),
      makeEvent({ id: 3, timesheet_status: "suggested" }),
    ],
    manualEntries: [
      makeManualEntry({ id: 7, timesheet_status: "needs_review" }),
      makeManualEntry({ id: 8, timesheet_status: "excluded" }),
    ],
  });

  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.counts, {
    suggested: 1,
    needs_review: 1,
    approved: 1,
    excluded: 2,
  } satisfies Record<TimesheetStatus, number>);
});

test("getTimesheetExportReadiness turns green when unresolved items are cleared", () => {
  const readiness: TimesheetExportReadiness = getTimesheetExportReadiness({
    events: [
      makeEvent({ timesheet_status: "approved" }),
      makeEvent({ id: 2, timesheet_status: "excluded" }),
    ],
    manualEntries: [
      makeManualEntry({ id: 7, timesheet_status: "approved" }),
    ],
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.unresolvedCount, 0);
});

test("buildTimesheetCsv formats leader-facing timesheet rows with stable columns", () => {
  const csv = buildTimesheetCsv([
    {
      date: "2026-03-09",
      project: "Chronos",
      category: "coding",
      task_description: 'Core "timesheet" work',
      duration_seconds: 5400,
      duration_label: "1:30",
      duration_hours: 1.5,
      source: "tracked",
    },
  ] satisfies TimesheetRow[]);

  assert.equal(
    csv,
    [
      "Date,Project,Task,Category,Duration H:MM,Duration Hours,Source",
      '2026-03-09,Chronos,"Core ""timesheet"" work",coding,1:30,1.50,tracked',
    ].join("\n")
  );
});
