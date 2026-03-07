import type { AssistantContextSnapshot } from "../../types/ai-types";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatEventTime(value: string): string {
  const time = value.split("T")[1] ?? value;
  return time.slice(0, 5);
}

export function buildAssistantContext(args: {
  currentView: string;
  snapshot: AssistantContextSnapshot;
}): string {
  const { currentView, snapshot } = args;
  const mostActiveProject = snapshot.top_projects[0];
  const summaryLines = [
    `Total tracked: ${formatDuration(snapshot.today_total_seconds)} today`,
    `Week total: ${formatDuration(snapshot.week_total_seconds)}`,
    `Today: ${snapshot.today_event_count} entries, ${snapshot.current_flow_minutes} flow minutes`,
    `Pending review: ${snapshot.pending_count}`,
    mostActiveProject
      ? `Most active this week: ${mostActiveProject.project} (${formatDuration(mostActiveProject.seconds)})`
      : "Most active this week: none yet",
  ];

  if (snapshot.recent_summaries[0]) {
    summaryLines.push(
      `Latest summary: ${snapshot.recent_summaries[0].summary} (score ${snapshot.recent_summaries[0].productivity_score.toFixed(1)})`
    );
  }

  const recentEntries = snapshot.recent_events.slice(0, 6).map((event) => {
    const project = event.project ? `Project: ${event.project}` : "Project: Unclassified";
    const task = event.task_description ? ` ${event.task_description}` : "";
    const end = event.end_time ? formatEventTime(event.end_time) : "now";
    const category = event.category ?? "unknown";
    const eventDate = event.start_time.split("T")[0] ?? snapshot.current_date;
    return `${eventDate} ${formatEventTime(event.start_time)}-${end} ${project} ${event.app_name}${task} [${category}]`;
  });

  return `<app_context>
  <current_view>${currentView}</current_view>
  <date_range>${snapshot.current_date}</date_range>
  <summary>
    ${summaryLines.join("\n    ")}
  </summary>
  <recent_entries>
${recentEntries.map((entry) => `- ${entry}`).join("\n")}
  </recent_entries>
</app_context>`;
}
