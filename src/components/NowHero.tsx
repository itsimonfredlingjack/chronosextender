import { useState, useEffect } from "react";
import type { Session } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import type { FlowStatus } from "../lib/types";

function useLiveTimer(startTime: string | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) { setElapsed(0); return; }
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return elapsed;
}

function formatLiveDuration(seconds: number): { main: string; secs: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return { main: `${h}h ${pad(m)}m`, secs: pad(s) };
  return { main: `${m}m`, secs: pad(s) };
}

interface NowHeroProps {
  currentSession: Session | null;
  flowStatus: FlowStatus;
}

export default function NowHero({ currentSession, flowStatus }: NowHeroProps) {
  if (!currentSession) {
    return (
      <div className="rounded-xl bg-gray-100 dark:bg-[#1a1a2e] p-6 border border-gray-200 dark:border-[#2a2a40]">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-gray-400/50" />
          <span className="text-lg font-medium text-gray-400">Idle</span>
        </div>
        <p className="text-sm text-gray-400 mt-2">No active tracking</p>
      </div>
    );
  }

  const category = currentSession.category;
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown;
  const label = CATEGORY_LABELS[category] || "Unknown";
  const isInFlow = flowStatus.in_flow;

  const liveElapsed = useLiveTimer(currentSession.start_time);
  const { main, secs } = formatLiveDuration(liveElapsed);

  return (
    <div
      className={`rounded-xl p-6 border-l-4 bg-white dark:bg-[#1a1a2e] dark:glass-card border border-gray-200 dark:border-[#2a2a40] transition-all animate-[breathe_3s_ease-in-out_infinite] ${
        isInFlow ? "ring-2 ring-indigo-400/50" : ""
      }`}
      style={{ borderLeftColor: color }}
      data-category={category}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Pulsing status orb */}
          <div className="relative">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ backgroundColor: color }}
            />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wide">
            {label}
          </span>
          {isInFlow && (
            <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-full font-medium">
              In Flow
            </span>
          )}
        </div>
        {/* Live timer */}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {main}
          </span>
          <span className="text-lg text-gray-400 dark:text-gray-500 tabular-nums">
            :{secs}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        {currentSession.project && (
          <>
            <span className="text-indigo-500 font-medium">
              {currentSession.project}
            </span>
            <span>·</span>
          </>
        )}
        <span>{currentSession.apps.join(" + ")}</span>
      </div>

      {/* Session progress bar */}
      <div className="mt-4 h-2 bg-gray-100 dark:bg-[#12121e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            backgroundColor: color,
            width: `${Math.min(100, (liveElapsed / 3600) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
