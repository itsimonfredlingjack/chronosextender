import type { AppContextSnapshot } from "../../types/ai-types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type { AppContextSnapshot } from "../../types/ai-types";

export function buildAppContextXml(snapshot: AppContextSnapshot): string {
  const summary = snapshot.summaryLines.map((line) => `    ${line}`).join("\n");
  const entries = snapshot.recentEntries.map((entry) => `    - ${entry}`).join("\n");

  return `<app_context>
  <current_view>${escapeXml(snapshot.currentView)}</current_view>
  <date_range>${escapeXml(snapshot.dateRange)}</date_range>
  <summary>
${summary}
  </summary>
  <recent_entries>
${entries}
  </recent_entries>
</app_context>`;
}
