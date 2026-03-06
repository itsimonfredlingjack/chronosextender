import type { Session, FlowStatus } from "../../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/types";
import { useLiveTimer, formatLiveDuration } from "../../lib/time";

interface Props {
  currentSession: Session | null;
  flowStatus: FlowStatus;
}

export default function OverlayPulse({ currentSession, flowStatus }: Props) {
  const liveElapsed = useLiveTimer(currentSession?.start_time ?? null);
  const { main, secs } = formatLiveDuration(liveElapsed);

  if (!currentSession) {
    return (
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gray-600" />
          <span className="text-base font-medium text-gray-500">Idle</span>
        </div>
        <p className="text-xs text-gray-500 mt-1.5 ml-6">
          Start working to begin tracking
        </p>
      </div>
    );
  }

  const category = currentSession.category;
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown;
  const label = CATEGORY_LABELS[category] || "Unknown";
  const isInFlow = flowStatus.in_flow;

  return (
    <div className="px-5 pt-5 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ backgroundColor: color }}
            />
          </div>
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="text-sm text-gray-500">{currentSession.apps[0]}</span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-lg font-bold text-white tabular-nums">{main}</span>
          <span className="text-sm text-gray-500 tabular-nums">:{secs}</span>
        </div>
      </div>

      <div className="mt-1 ml-[22px] flex items-center gap-2 text-xs text-gray-400">
        {currentSession.project && (
          <>
            <span className="font-medium" style={{ color }}>
              {currentSession.project}
            </span>
            <span>·</span>
          </>
        )}
        {isInFlow && (
          <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full font-medium text-[10px]">
            In Flow
          </span>
        )}
      </div>
    </div>
  );
}
