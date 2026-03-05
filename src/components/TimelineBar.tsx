import type { Event, Category } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import { useState } from "react";

interface TimelineBarProps {
  events: Event[];
  startHour?: number;
  endHour?: number;
}

interface TooltipData {
  event: Event;
  x: number;
  y: number;
}

export default function TimelineBar({
  events,
  startHour = 6,
  endHour = 23,
}: TimelineBarProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const totalMinutes = (endHour - startHour) * 60;

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );

  const getPosition = (timeStr: string) => {
    const date = new Date(timeStr);
    const minutes = date.getHours() * 60 + date.getMinutes() - startHour * 60;
    return Math.max(0, Math.min(totalMinutes, minutes));
  };

  return (
    <div className="relative">
      {/* Hour labels */}
      <div className="flex text-xs text-gray-400 dark:text-gray-500 mb-1">
        {hours.map((h) => (
          <div
            key={h}
            className="flex-1 text-center"
            style={{ minWidth: 0 }}
          >
            {h}:00
          </div>
        ))}
      </div>

      {/* Timeline track */}
      <div className="relative h-10 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
        {events.map((event) => {
          const startMin = getPosition(event.start_time);
          const durationMin = event.duration_seconds / 60;
          const left = (startMin / totalMinutes) * 100;
          const width = Math.max(0.3, (durationMin / totalMinutes) * 100);
          const category = (event.category || "unknown") as Category;
          const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown;

          return (
            <div
              key={event.id}
              className="absolute top-0 h-full cursor-pointer transition-opacity hover:opacity-80"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: color,
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  event,
                  x: e.clientX,
                  y: e.clientY,
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2 text-xs border border-gray-200 dark:border-gray-700 pointer-events-none"
          style={{ left: tooltip.x + 10, top: tooltip.y - 60 }}
        >
          <p className="font-medium text-gray-900 dark:text-white">
            {tooltip.event.app_name}
          </p>
          {tooltip.event.window_title && (
            <p className="text-gray-500 dark:text-gray-400 truncate max-w-60">
              {tooltip.event.window_title}
            </p>
          )}
          <p className="text-gray-400 mt-1">
            {CATEGORY_LABELS[(tooltip.event.category || "unknown") as Category]}{" "}
            - {Math.round(tooltip.event.duration_seconds / 60)}m
          </p>
        </div>
      )}

      {/* Category legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
          const hasEvents = events.some((e) => (e.category || "unknown") === cat);
          if (!hasEvents) return null;
          return (
            <div key={cat} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {CATEGORY_LABELS[cat as Category]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
