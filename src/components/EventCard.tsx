import type { Event, Category } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";

interface EventCardProps {
  event: Event;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function EventCard({ event, compact }: EventCardProps) {
  const category = (event.category || "unknown") as Category;
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown;
  const label = CATEGORY_LABELS[category] || "Unknown";

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm text-slate-800 truncate flex-1">{event.app_name}</span>
        <span className="text-xs text-slate-600">{formatDuration(event.duration_seconds)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-[#fcfaf5] rounded-lg border border-[#d7d0c3]">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: color }}
      >
        {event.app_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800 truncate">{event.app_name}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {label}
          </span>
        </div>
        {event.window_title && (
          <p className="text-xs text-slate-600 truncate mt-0.5">{event.window_title}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>{formatTime(event.start_time)}</span>
          <span>{formatDuration(event.duration_seconds)}</span>
          {event.project && <span className="text-indigo-600">{event.project}</span>}
          <span title={event.classification_source}>
            {event.classification_source === "rule" && "\u229E"}
            {event.classification_source === "llm" && "\u26A1"}
            {event.classification_source === "manual" && "\u2713"}
            {event.classification_source === "pending" && "?"}
          </span>
        </div>
      </div>
    </div>
  );
}
