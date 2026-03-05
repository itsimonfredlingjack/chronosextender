import type { Event, Category, Session } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import { aggregateToSessions, formatDuration } from "../lib/sessions";
import { useState, useMemo, useEffect } from "react";

interface TimelineBarProps {
  events: Event[];
}

interface TooltipData {
  session: Session;
  x: number;
  y: number;
}

function computeTimeBounds(events: Event[]): { startHour: number; endHour: number } {
  const now = new Date();
  const currentHour = now.getHours();

  if (events.length === 0) {
    return {
      startHour: Math.max(0, currentHour - 2),
      endHour: Math.min(24, currentHour + 2),
    };
  }

  let earliest = 24;
  let latest = 0;

  for (const e of events) {
    const startH = new Date(e.start_time).getHours();
    const endH = e.end_time ? new Date(e.end_time).getHours() + 1 : currentHour + 1;
    earliest = Math.min(earliest, startH);
    latest = Math.max(latest, endH);
  }

  // Include current time
  latest = Math.max(latest, currentHour + 1);

  // Add 1h padding
  earliest = Math.max(0, earliest - 1);
  latest = Math.min(24, latest + 1);

  // Minimum 4h span
  if (latest - earliest < 4) {
    const mid = Math.floor((earliest + latest) / 2);
    earliest = Math.max(0, mid - 2);
    latest = Math.min(24, mid + 2);
  }

  return { startHour: earliest, endHour: latest };
}

export default function TimelineBar({ events }: TimelineBarProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [nowPosition, setNowPosition] = useState(0);

  const sessions = useMemo(() => aggregateToSessions(events), [events]);
  const { startHour, endHour } = useMemo(() => computeTimeBounds(events), [events]);

  const totalMinutes = (endHour - startHour) * 60;

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );

  const getMinuteOffset = (timeStr: string) => {
    const date = new Date(timeStr);
    const minutes = date.getHours() * 60 + date.getMinutes() - startHour * 60;
    return Math.max(0, Math.min(totalMinutes, minutes));
  };

  // Update "now" needle every 30s
  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes() - startHour * 60;
      setNowPosition(Math.max(0, Math.min(100, (mins / totalMinutes) * 100)));
    };
    updateNow();
    const id = setInterval(updateNow, 30000);
    return () => clearInterval(id);
  }, [startHour, totalMinutes]);

  return (
    <div className="relative">
      {/* Hour labels */}
      <div className="flex text-xs text-gray-400 dark:text-gray-500 mb-1">
        {hours.map((h) => (
          <div key={h} className="flex-1 text-center" style={{ minWidth: 0 }}>
            {h}
          </div>
        ))}
      </div>

      {/* Timeline track */}
      <div className="relative h-20 bg-gray-100 dark:bg-[#12121e] rounded-lg overflow-hidden">
        {sessions.map((session, i) => {
          const startMin = getMinuteOffset(session.start_time);
          const endMin = getMinuteOffset(session.end_time);
          const durationMin = Math.max(endMin - startMin, session.duration_seconds / 60);
          const left = (startMin / totalMinutes) * 100;
          const width = Math.max(0.5, (durationMin / totalMinutes) * 100);
          const color = CATEGORY_COLORS[session.category] || CATEGORY_COLORS.unknown;
          const label = CATEGORY_LABELS[session.category] || "Unknown";
          const showLabel = width > 8;

          return (
            <div
              key={`${session.start_time}-${i}`}
              className="absolute top-0 h-full cursor-pointer transition-opacity hover:opacity-80 flex items-center justify-center overflow-hidden rounded-sm"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: color,
                boxShadow: `0 1px 8px ${color}30`,
              }}
              onMouseEnter={(e) =>
                setTooltip({ session, x: e.clientX, y: e.clientY })
              }
              onMouseMove={(e) =>
                setTooltip((prev) =>
                  prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                )
              }
              onMouseLeave={() => setTooltip(null)}
            >
              {showLabel && (
                <span className="text-[10px] font-medium text-white/90 truncate px-1">
                  {label}
                </span>
              )}
            </div>
          );
        })}

        {/* Now needle */}
        {nowPosition > 0 && nowPosition < 100 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
            style={{
              left: `${nowPosition}%`,
              animation: "now-needle-pulse 2s ease-in-out infinite",
            }}
          >
            <div className="absolute -top-1 -left-[3px] w-2 h-2 rounded-full bg-red-500" />
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white dark:bg-[#1a1a2e]/95 dark:backdrop-blur-md shadow-lg rounded-lg p-3 text-xs border border-gray-200 dark:border-[#2a2a40] pointer-events-none max-w-64"
          style={{ left: tooltip.x + 10, top: tooltip.y - 80 }}
        >
          <p className="font-medium text-gray-900 dark:text-white">
            {CATEGORY_LABELS[tooltip.session.category] || "Unknown"}
          </p>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">
            {tooltip.session.apps.join(", ")}
          </p>
          <p className="text-gray-400 mt-1">
            {formatDuration(tooltip.session.duration_seconds)} ·{" "}
            {tooltip.session.events.length} event
            {tooltip.session.events.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Category legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
          const hasEvents = sessions.some((s) => s.category === cat);
          if (!hasEvents) return null;
          return (
            <div
              key={cat}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
            >
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
