import type { Session } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import type { FlowStatus } from "../lib/types";
import { useLiveTimer, formatLiveDuration } from "../lib/time";

interface NowHeroProps {
  currentSession: Session | null;
  flowStatus: FlowStatus;
}

export default function NowHero({ currentSession, flowStatus }: NowHeroProps) {
  if (!currentSession) {
    return (
      <div className="rounded-xl bg-[#fcfaf5] p-6 border border-[#d7d0c3] card-elevated">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-gray-600" />
          <span className="text-lg font-medium text-slate-500">Idle</span>
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Start working to begin tracking
        </p>
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
      className={`rounded-xl p-6 border-l-4 bg-[#fcfaf5] glass-card border border-[#d7d0c3] card-elevated transition-shadow ${
        isInFlow ? "ring-2 ring-indigo-400/50" : ""
      }`}
      style={{ borderLeftColor: color }}
      data-category={category}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          <span className="text-lg font-semibold text-[var(--color-text-primary)]">{label}</span>
          {isInFlow && (
            <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-700 rounded-full font-medium">
              In Flow
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">{main}</span>
          <span className="text-lg text-slate-500 tabular-nums">:{secs}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
        {currentSession.project && (
          <>
            <span className="text-indigo-600 font-medium">{currentSession.project}</span>
            <span>·</span>
          </>
        )}
        <span>{currentSession.apps.join(" + ")}</span>
      </div>

      <div className="mt-4 h-2 bg-[#f3ede2] rounded-full overflow-hidden">
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
