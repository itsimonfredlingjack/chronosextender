import { getEventTimesheetStatus, getTimesheetExportReadiness } from "./timesheets";
import type {
  Event,
  ManualTimeEntry,
  Project,
  TimesheetExportReadiness,
} from "./types";

// Stable report aggregation shared by the Reports page and its tests.
export interface ReportBreakdownEntry {
  seconds: number;
  hours: number;
}

export interface ReportProjectBreakdownEntry extends ReportBreakdownEntry {
  project: string;
  billable: boolean;
}

export interface ReportCategoryBreakdownEntry extends ReportBreakdownEntry {
  category: string;
}

export interface ReportOverview {
  trackedSeconds: number;
  manualSeconds: number;
  loggedSeconds: number;
  billableHours: number;
  unresolvedCount: number;
  readyForExport: boolean;
  counts: TimesheetExportReadiness["counts"];
  projectBreakdown: ReportProjectBreakdownEntry[];
  categoryBreakdown: ReportCategoryBreakdownEntry[];
}

function toHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

function normaliseProject(project: string | null | undefined): string {
  return project?.trim() || "Unclassified";
}

function normaliseCategory(category: Event["category"] | ManualTimeEntry["category"]): string {
  return category ?? "unknown";
}

export function buildReportOverview(args: {
  events: Event[];
  manualEntries: ManualTimeEntry[];
  projects: Project[];
}): ReportOverview {
  const readiness = getTimesheetExportReadiness({
    events: args.events,
    manualEntries: args.manualEntries,
  });
  const billableProjects = new Set(
    args.projects.filter((project) => project.is_billable).map((project) => project.name)
  );
  const projectMap = new Map<string, { seconds: number; billable: boolean }>();
  const categoryMap = new Map<string, number>();

  let trackedSeconds = 0;
  let manualSeconds = 0;
  let billableSeconds = 0;

  const addEntry = (
    project: string | null | undefined,
    category: Event["category"] | ManualTimeEntry["category"],
    durationSeconds: number
  ) => {
    const projectName = normaliseProject(project);
    const categoryName = normaliseCategory(category);
    const billable = billableProjects.has(projectName);
    const existingProject = projectMap.get(projectName);

    if (existingProject) {
      existingProject.seconds += durationSeconds;
    } else {
      projectMap.set(projectName, { seconds: durationSeconds, billable });
    }

    categoryMap.set(categoryName, (categoryMap.get(categoryName) ?? 0) + durationSeconds);

    if (billable) {
      billableSeconds += durationSeconds;
    }
  };

  for (const event of args.events) {
    if (getEventTimesheetStatus(event) === "excluded") continue;
    trackedSeconds += event.duration_seconds;
    addEntry(event.project, event.category, event.duration_seconds);
  }

  for (const entry of args.manualEntries) {
    if (entry.timesheet_status === "excluded") continue;
    manualSeconds += entry.duration_seconds;
    addEntry(entry.project, entry.category, entry.duration_seconds);
  }

  return {
    trackedSeconds,
    manualSeconds,
    loggedSeconds: trackedSeconds + manualSeconds,
    billableHours: toHours(billableSeconds),
    unresolvedCount: readiness.unresolvedCount,
    readyForExport: readiness.ready,
    counts: readiness.counts,
    projectBreakdown: [...projectMap.entries()]
      .map(([project, value]) => ({
        project,
        seconds: value.seconds,
        hours: toHours(value.seconds),
        billable: value.billable,
      }))
      .sort((a, b) => b.seconds - a.seconds),
    categoryBreakdown: [...categoryMap.entries()]
      .map(([category, seconds]) => ({
        category,
        seconds,
        hours: toHours(seconds),
      }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}
