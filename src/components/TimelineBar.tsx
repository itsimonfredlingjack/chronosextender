import type { Event, Session } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import { aggregateToSessions, formatDuration } from "../lib/sessions";
import { useState, useMemo, useEffect, useRef } from "react";

interface TimelineBarProps {
  events: Event[];
}

interface TooltipData {
  session: Session;
  x: number;
  y: number;
}

export default function TimelineBar({ events }: TimelineBarProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const sessions = useMemo(() => aggregateToSessions(events), [events]);

  // Find max duration for height scaling
  const maxDuration = useMemo(
    () => Math.max(...sessions.map((s) => s.duration_seconds), 1),
    [sessions]
  );

  // Compute time bounds for proportional width
  const timeBounds = useMemo(() => {
    if (sessions.length === 0) return { startMin: 0, totalMin: 1 };
    const now = new Date();
    const firstStart = new Date(sessions[0].start_time);
    const startMin = firstStart.getHours() * 60 + firstStart.getMinutes();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const totalMin = Math.max(nowMin - startMin, 60);
    return { startMin, totalMin };
  }, [sessions]);

  // Detect active (last session with no end_time on last event)
  const activeSessionIdx = useMemo(() => {
    if (sessions.length === 0) return -1;
    const last = sessions[sessions.length - 1];
    const lastEvent = last.events[last.events.length - 1];
    return lastEvent.end_time ? -1 : sessions.length - 1;
  }, [sessions]);

  // Pulse animation for active bar
  useEffect(() => {
    setActiveIndex(activeSessionIdx);
  }, [activeSessionIdx]);

  if (sessions.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Waveform container */}
      <div className="flex items-end gap-[2px] h-12">
        {sessions.map((session, i) => {
          const color = CATEGORY_COLORS[session.category] || CATEGORY_COLORS.unknown;

          // Height: proportional to duration (min 12%, max 100%)
          const heightPct = Math.max(12, (session.duration_seconds / maxDuration) * 100);

          // Width: proportional to time span in the day
          const sessionStart = new Date(session.start_time);
          const startMin = sessionStart.getHours() * 60 + sessionStart.getMinutes();
          const spanMin = Math.max(session.duration_seconds / 60, 1);
          const widthPct = Math.max(1.5, (spanMin / timeBounds.totalMin) * 100);

          // Gap before this bar (idle time)
          let gapPct = 0;
          if (i > 0) {
            const prevEnd = sessions[i - 1].end_time;
            const prevEndMin = new Date(prevEnd).getHours() * 60 + new Date(prevEnd).getMinutes();
            const gapMin = Math.max(0, startMin - prevEndMin);
            gapPct = (gapMin / timeBounds.totalMin) * 100;
          } else {
            const gapMin = Math.max(0, startMin - timeBounds.startMin);
            gapPct = (gapMin / timeBounds.totalMin) * 100;
          }

          const isActive = i === activeIndex;

          return (
            <div
              key={`${session.start_time}-${i}`}
              className="flex items-end animate-slide-up"
              style={{
                marginLeft: gapPct > 1.5 ? `${gapPct}%` : undefined,
                animationDelay: `${i * 30}ms`,
              }}
            >
              <div
                className={`rounded cursor-pointer transition-all duration-300 hover:brightness-125 hover:scale-y-110 ${isActive ? "animate-waveform-pulse" : ""
                  }`}
                style={{
                  height: `${heightPct}%`,
                  width: `max(3px, ${widthPct}%)`,
                  minWidth: "3px",
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}40, 0 0 2px ${color}20`,
                  opacity: isActive ? 1 : 0.85,
                  transformOrigin: "bottom",
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
              />
            </div>
          );
        })}
      </div>

      {/* Baseline + hour labels */}
      <div className="h-px bg-[var(--color-border)] mt-1" />
      <div className="flex justify-between mt-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="text-[8px] text-slate-500 tabular-nums font-mono">
            {(8 + i).toString().padStart(2, "0")}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[var(--color-card)] backdrop-blur-md shadow-[0_16px_32px_rgba(30,41,59,0.18)] rounded-lg p-3 text-xs border border-[var(--color-border)] pointer-events-none max-w-64"
          style={{ left: tooltip.x + 10, top: tooltip.y - 80 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[tooltip.session.category] }}
            />
            <span className="font-medium text-slate-900">
              {CATEGORY_LABELS[tooltip.session.category] || "Unknown"}
            </span>
          </div>
          <p className="text-slate-600">
            {tooltip.session.apps.join(", ")}
          </p>
          <p className="text-slate-500 mt-1">
            {formatDuration(tooltip.session.duration_seconds)}
            {tooltip.session.project && (
              <span className="text-slate-400"> · {tooltip.session.project}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
