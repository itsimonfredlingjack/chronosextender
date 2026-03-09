import type { Event, Session, Category, WorkBlock } from "./types";
import { aggregateToSessions } from "./sessions";
import { getEventTimesheetStatus } from "./timesheets";
import { CATEGORY_LABELS } from "./types";

const MAX_BLOCK_GAP_SECONDS = 1800; // 30 minutes
const BRIEF_GAP_SECONDS = 300; // 5 minutes

const CATEGORY_AFFINITY: Record<string, Set<string>> = {
  coding: new Set(["documentation", "browsing"]),
  documentation: new Set(["coding", "browsing"]),
  browsing: new Set(["coding", "documentation", "design", "admin"]),
  communication: new Set(["meeting"]),
  meeting: new Set(["communication"]),
  design: new Set(["browsing"]),
  admin: new Set(["browsing"]),
};

const BLOCK_LABELS: Record<string, string> = {
  coding: "Development",
  "browsing+coding": "Development",
  "coding+documentation": "Development & Docs",
  "browsing+coding+documentation": "Development",
  communication: "Communication",
  "communication+meeting": "Meetings & Communication",
  meeting: "Meetings",
  design: "Design Work",
  "browsing+design": "Design Research",
  admin: "Admin",
  "admin+browsing": "Admin",
  entertainment: "Break",
  browsing: "Research & Browsing",
  documentation: "Documentation",
};

function areCategoriesRelated(a: Category, b: Category): boolean {
  return CATEGORY_AFFINITY[a]?.has(b) || false;
}

function getGapSeconds(endTime: string, startTime: string): number {
  return (new Date(startTime).getTime() - new Date(endTime).getTime()) / 1000;
}

function generateBlockLabel(categories: Category[]): string {
  const sorted = [...new Set(categories)].sort();
  const key = sorted.join("+");
  return BLOCK_LABELS[key] || CATEGORY_LABELS[sorted[0]] || "Mixed Activity";
}

function getDominantCategory(sessions: Session[]): Category {
  const map: Record<string, number> = {};
  for (const s of sessions) {
    map[s.category] = (map[s.category] || 0) + s.duration_seconds;
  }
  let max = 0;
  let dominant: Category = "unknown";
  for (const [cat, secs] of Object.entries(map)) {
    if (secs > max) {
      max = secs;
      dominant = cat as Category;
    }
  }
  return dominant;
}

function getDominantProject(sessions: Session[]): string | null {
  const map: Record<string, number> = {};
  for (const s of sessions) {
    if (s.project) {
      map[s.project] = (map[s.project] || 0) + s.duration_seconds;
    }
  }
  let max = 0;
  let dominant: string | null = null;
  for (const [proj, secs] of Object.entries(map)) {
    if (secs > max) {
      max = secs;
      dominant = proj;
    }
  }
  return dominant;
}

export function isEventPendingReview(event: Event): boolean {
  const status = getEventTimesheetStatus(event);
  return status === "needs_review" || status === "suggested";
}

export function aggregateToWorkBlocks(events: Event[]): WorkBlock[] {
  const sessions = aggregateToSessions(events);
  if (sessions.length === 0) return [];

  const blocks: WorkBlock[] = [];
  let currentSessions: Session[] = [sessions[0]];

  for (let i = 1; i < sessions.length; i++) {
    const prev = currentSessions[currentSessions.length - 1];
    const curr = sessions[i];
    const gap = getGapSeconds(prev.end_time, curr.start_time);

    const related = areCategoriesRelated(
      prev.category,
      curr.category
    );
    const shouldMerge =
      (gap <= MAX_BLOCK_GAP_SECONDS && related) ||
      (gap <= BRIEF_GAP_SECONDS) ||
      (prev.category === curr.category && gap <= MAX_BLOCK_GAP_SECONDS);

    if (shouldMerge) {
      currentSessions.push(curr);
    } else {
      blocks.push(buildBlock(currentSessions, blocks.length));
      currentSessions = [curr];
    }
  }

  blocks.push(buildBlock(currentSessions, blocks.length));
  return blocks.reverse(); // newest first
}

export function aggregateToReviewWorkBlocks(events: Event[]): WorkBlock[] {
  return aggregateToWorkBlocks(events.filter(isEventPendingReview));
}

function buildBlock(sessions: Session[], index: number): WorkBlock {
  const allEvents = sessions.flatMap((s) => s.events);
  const categories = [...new Set(sessions.map((s) => s.category))];
  const apps = [...new Set(sessions.flatMap((s) => s.apps))];

  return {
    id: `block-${index}-${sessions[0].start_time}`,
    label: generateBlockLabel(categories),
    sessions,
    events: allEvents,
    categories,
    dominantCategory: getDominantCategory(sessions),
    apps,
    start_time: sessions[0].start_time,
    end_time: sessions[sessions.length - 1].end_time,
    duration_seconds: sessions.reduce((sum, s) => sum + s.duration_seconds, 0),
    project: getDominantProject(sessions),
    approved: false,
  };
}

export function generateBlockDescription(block: WorkBlock): string {
  const appList = block.apps.slice(0, 3);
  const appStr =
    appList.length === 1
      ? appList[0]
      : appList.length === 2
        ? `${appList[0]} and ${appList[1]}`
        : `${appList[0]}, ${appList[1]}, and ${appList[2]}`;

  const hours = Math.floor(block.duration_seconds / 3600);
  const mins = Math.floor((block.duration_seconds % 3600) / 60);
  const durStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  if (block.categories.length === 1) {
    return `${durStr} of ${block.label.toLowerCase()} using ${appStr}.`;
  }

  return `You moved between ${appStr} for ${durStr}. This looks like a ${block.label.toLowerCase()} session.`;
}
