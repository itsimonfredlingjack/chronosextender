import type { Event, Category } from "./types";
import { CATEGORY_LABELS } from "./types";
import { aggregateToSessions } from "./sessions";

export interface Insight {
  text: string;
  type: "positive" | "warning" | "neutral";
}

export function generateInsights(events: Event[]): Insight[] {
  if (events.length < 3) return [];

  const insights: Insight[] = [];
  const sessions = aggregateToSessions(events);
  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);

  if (totalSeconds === 0) return [];

  // 1. Longest streak
  if (sessions.length > 0) {
    const longest = sessions.reduce((a, b) =>
      a.duration_seconds > b.duration_seconds ? a : b
    );
    const mins = Math.floor(longest.duration_seconds / 60);
    const label = CATEGORY_LABELS[longest.category as Category] || longest.category;
    if (mins >= 30) {
      insights.push({
        text: `You ${label.toLowerCase() === "coding" ? "coded" : `spent time on ${label.toLowerCase()}`} for ${formatMins(mins)} straight — impressive focus.`,
        type: "positive",
      });
    }
  }

  // 2. Peak productivity hour
  const hourMap: Record<number, number> = {};
  const productiveCategories = new Set(["coding", "documentation", "design"]);
  for (const e of events) {
    if (productiveCategories.has(e.category || "")) {
      const hour = new Date(e.start_time).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + e.duration_seconds;
    }
  }
  const peakHour = Object.entries(hourMap).sort(
    ([, a], [, b]) => b - a
  )[0];
  if (peakHour && peakHour[1] >= 600) {
    const h = parseInt(peakHour[0]);
    insights.push({
      text: `Most productive window: ${pad(h)}:00–${pad(h + 1)}:00 with ${formatMins(Math.floor(peakHour[1] / 60))} of focused work.`,
      type: "positive",
    });
  }

  // 3. Category dominance
  const categoryMap: Record<string, number> = {};
  for (const e of events) {
    const cat = e.category || "unknown";
    categoryMap[cat] = (categoryMap[cat] || 0) + e.duration_seconds;
  }
  const dominant = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)[0];
  if (dominant) {
    const pct = Math.round((dominant[1] / totalSeconds) * 100);
    const label = CATEGORY_LABELS[dominant[0] as Category] || dominant[0];
    if (pct >= 40) {
      const isProductive = productiveCategories.has(dominant[0]);
      insights.push({
        text: `${label} took ${pct}% of your day${isProductive ? " — great focus!" : " — more than any other activity."}`,
        type: isProductive ? "positive" : "neutral",
      });
    }
  }

  // 4. Break detection
  if (sessions.length >= 2) {
    let breaks = 0;
    let totalBreakTime = 0;
    for (let i = 1; i < sessions.length; i++) {
      const gap =
        (new Date(sessions[i].start_time).getTime() -
          new Date(sessions[i - 1].end_time).getTime()) /
        1000;
      if (gap > 900) {
        breaks++;
        totalBreakTime += gap;
      }
    }

    if (breaks > 0) {
      const avgBreak = Math.round(totalBreakTime / breaks / 60);
      insights.push({
        text: `You took ${breaks} break${breaks > 1 ? "s" : ""} today, averaging ${avgBreak}m. Good pacing.`,
        type: "positive",
      });
    } else {
      const totalMins = Math.floor(totalSeconds / 60);
      if (totalMins > 120) {
        insights.push({
          text: `No breaks detected in ${formatMins(totalMins)} of tracking — your body will thank you for stretching.`,
          type: "warning",
        });
      }
    }
  }

  // 5. App switching frequency
  const switches = events.length - 1;
  if (switches > 30) {
    insights.push({
      text: `You switched apps ${switches} times today — context-switching has a cognitive cost.`,
      type: "warning",
    });
  }

  return insights.slice(0, 5);
}

function formatMins(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
