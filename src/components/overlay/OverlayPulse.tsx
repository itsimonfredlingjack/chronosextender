import type { Session, FlowStatus } from "../../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/types";
import { useLiveTimer, formatLiveDuration } from "../../lib/time";

function PauseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1.5" y="1" width="3.5" height="10" rx="1"/>
      <rect x="7" y="1" width="3.5" height="10" rx="1"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z"/>
    </svg>
  );
}

interface Props {
  currentSession: Session | null;
  flowStatus: FlowStatus;
  trackingActive: boolean;
  onToggle: () => void;
}

export default function OverlayPulse({ currentSession, flowStatus, trackingActive, onToggle }: Props) {
  const liveElapsed = useLiveTimer(currentSession?.start_time ?? null);
  const { main, secs } = formatLiveDuration(liveElapsed);

  if (!currentSession) {
    return (
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span className="text-base font-medium text-slate-600">Idle</span>
          </div>
          <button
            onClick={onToggle}
            title={trackingActive ? "Pause tracking" : "Resume tracking"}
            className="text-slate-500 hover:text-slate-800 transition-colors opacity-70 hover:opacity-100 p-1"
          >
            {trackingActive ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1.5 ml-6">
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
              className={`w-3 h-3 rounded-full ${trackingActive ? "" : "bg-slate-400"}`}
              style={trackingActive ? { backgroundColor: color } : undefined}
            />
            {trackingActive && (
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: color }}
              />
            )}
          </div>
          <span className="text-sm font-semibold text-slate-900">{label}</span>
          <span className="text-sm text-slate-500">{currentSession.apps[0]}</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg hover:bg-[var(--color-elevated)] px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors cursor-default">
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold text-slate-900 tabular-nums">{main}</span>
            <span className="text-sm text-slate-500 tabular-nums">:{secs}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            title={trackingActive ? "Pause tracking" : "Resume tracking"}
            className="text-slate-500 hover:text-slate-800 transition-colors opacity-70 hover:opacity-100 p-1 ml-0.5"
          >
            {trackingActive ? <PauseIcon /> : <PlayIcon />}
          </button>
        </div>
      </div>

      <div className="mt-1 ml-[22px] flex items-center gap-2 text-xs text-slate-600">
        {!trackingActive && (
          <span className="px-1.5 py-0.5 bg-slate-400/20 text-slate-600 rounded-full font-medium text-[10px]">
            Paused
          </span>
        )}
        {currentSession.project && (
          <>
            <span className="font-medium" style={{ color: trackingActive ? color : undefined }}>
              {currentSession.project}
            </span>
            <span>·</span>
          </>
        )}
        {isInFlow && trackingActive && (
          <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-700 rounded-full font-medium text-[10px]">
            In Flow
          </span>
        )}
      </div>
    </div>
  );
}
