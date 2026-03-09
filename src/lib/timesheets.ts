import type {
  Event,
  ManualTimeEntry,
  TimesheetExportReadiness,
  TimesheetRow,
  TimesheetStatus,
} from "./types";

function formatDurationLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function getEventDate(value: string): string {
  return value.split("T")[0] ?? value;
}

function normaliseProject(project: string | null | undefined): string {
  return project?.trim() || "Unclassified";
}

function normaliseCategory(category: Event["category"] | ManualTimeEntry["category"]): TimesheetRow["category"] {
  return category ?? "unknown";
}

function normaliseTask(task: string | null | undefined): string {
  return task?.trim() || "General work";
}

export function resolveDefaultTimesheetStatus(event: Event): TimesheetStatus {
  if (
    event.classification_source === "pending" ||
    event.confidence < 0.5 ||
    !event.category ||
    !event.project
  ) {
    return "needs_review";
  }

  return "suggested";
}

export function getEventTimesheetStatus(event: Event): TimesheetStatus {
  return event.timesheet_status ?? resolveDefaultTimesheetStatus(event);
}

export function getBlockTimesheetStatus(events: Event[]): TimesheetStatus {
  const statuses = events.map(getEventTimesheetStatus);
  if (statuses.some((status) => status === "needs_review")) return "needs_review";
  if (statuses.some((status) => status === "suggested")) return "suggested";
  if (statuses.some((status) => status === "approved")) return "approved";
  return "excluded";
}

export function aggregateApprovedTimesheetRows(args: {
  events: Event[];
  manualEntries: ManualTimeEntry[];
}): TimesheetRow[] {
  const rowMap = new Map<string, TimesheetRow>();

  const upsertRow = (
    date: string,
    project: string | null | undefined,
    category: Event["category"] | ManualTimeEntry["category"],
    task: string | null | undefined,
    durationSeconds: number,
    source: TimesheetRow["source"]
  ) => {
    const rowProject = normaliseProject(project);
    const rowCategory = normaliseCategory(category);
    const rowTask = normaliseTask(task);
    const key = [date, rowProject, rowCategory, rowTask, source].join("|");
    const existing = rowMap.get(key);

    if (existing) {
      existing.duration_seconds += durationSeconds;
      existing.duration_label = formatDurationLabel(existing.duration_seconds);
      existing.duration_hours =
        Math.round((existing.duration_seconds / 3600) * 100) / 100;
      return;
    }

    rowMap.set(key, {
      date,
      project: rowProject,
      category: rowCategory,
      task_description: rowTask,
      duration_seconds: durationSeconds,
      duration_label: formatDurationLabel(durationSeconds),
      duration_hours: Math.round((durationSeconds / 3600) * 100) / 100,
      source,
    });
  };

  for (const event of args.events) {
    if (getEventTimesheetStatus(event) !== "approved") continue;
    upsertRow(
      getEventDate(event.start_time),
      event.project,
      event.category,
      event.task_description,
      event.duration_seconds,
      "tracked"
    );
  }

  for (const entry of args.manualEntries) {
    if (entry.timesheet_status !== "approved") continue;
    upsertRow(
      entry.entry_date,
      entry.project,
      entry.category,
      entry.task_description,
      entry.duration_seconds,
      entry.source
    );
  }

  return [...rowMap.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    if (a.task_description !== b.task_description) {
      return a.task_description.localeCompare(b.task_description);
    }
    return a.source.localeCompare(b.source);
  });
}

export function getTimesheetExportReadiness(args: {
  events: Event[];
  manualEntries: ManualTimeEntry[];
}): TimesheetExportReadiness {
  const counts: Record<TimesheetStatus, number> = {
    suggested: 0,
    needs_review: 0,
    approved: 0,
    excluded: 0,
  };

  for (const event of args.events) {
    counts[getEventTimesheetStatus(event)] += 1;
  }

  for (const entry of args.manualEntries) {
    counts[entry.timesheet_status] += 1;
  }

  const unresolvedCount = counts.suggested + counts.needs_review;

  return {
    ready: unresolvedCount === 0,
    unresolvedCount,
    counts,
  };
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTimesheetCsv(rows: TimesheetRow[]): string {
  const header = "Date,Project,Task,Category,Duration H:MM,Duration Hours,Source";
  const lines = rows.map((row) =>
    [
      row.date,
      escapeCsv(row.project),
      escapeCsv(row.task_description),
      row.category,
      row.duration_label,
      row.duration_hours.toFixed(2),
      row.source,
    ].join(",")
  );

  return [header, ...lines].join("\n");
}
