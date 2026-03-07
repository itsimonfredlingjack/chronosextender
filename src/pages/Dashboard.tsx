import { useMemo, useState, useEffect } from "react";
import { useEvents } from "../hooks/useEvents";
import { useFlowState } from "../hooks/useFlowState";
import { useLiveTimer, formatLiveDuration } from "../lib/time";
import { aggregateToSessions, formatDuration } from "../lib/sessions";
import { computeLeakage, formatGapDuration } from "../lib/leakage";
import TimelineBar from "../components/TimelineBar";
import CategoryRace from "../components/CategoryRace";
import { api } from "../lib/tauri";
import type { Category, Session } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";

function PauseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <rect x="3" y="2" width="5.5" height="16" rx="1.5" />
      <rect x="11.5" y="2" width="5.5" height="16" rx="1.5" />
    </svg>
  );
}

function PlayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 2.5L17 10L4 17.5V2.5Z" />
    </svg>
  );
}

function ActivePulse({
  session,
  flowStatus,
  trackingActive,
  onToggle,
}: {
  session: Session;
  flowStatus: { in_flow: boolean };
  trackingActive: boolean;
  onToggle: () => void;
}) {
  const color = CATEGORY_COLORS[session.category] || CATEGORY_COLORS.unknown;
  const label = CATEGORY_LABELS[session.category] || "Unknown";
  const liveElapsed = useLiveTimer(session.start_time);
  const { main, secs } = formatLiveDuration(liveElapsed);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Category indicator with halo */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="relative">
          <div
            className={`w-2.5 h-2.5 rounded-full ${trackingActive ? "" : "bg-gray-600"}`}
            style={trackingActive ? { backgroundColor: color } : undefined}
          />
          {trackingActive && (
            <>
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: color }}
              />
              <div
                className="absolute -inset-1.5 rounded-full animate-ring-pulse"
                style={{ border: `1.5px solid ${color}`, opacity: 0.2 }}
              />
            </>
          )}
        </div>
        <span
          className={`text-sm font-medium tracking-wide uppercase ${trackingActive ? "" : "text-gray-500"}`}
          style={trackingActive ? { color } : undefined}
        >
          {label}
        </span>
      </div>

      {/* App name */}
      <span className="text-base text-gray-400 mb-2">
        {session.apps[0]}
        {session.apps.length > 1 && (
          <span className="text-gray-600"> + {session.apps.length - 1}</span>
        )}
      </span>

      {/* THE timer + inline pause button */}
      <div className="flex items-center gap-4">
        <div className="flex items-baseline">
          <span
            className="text-[72px] leading-none font-light text-white tabular-nums tracking-tight"
            style={{ textShadow: "0 0 40px rgba(255, 255, 255, 0.05)" }}
          >
            {main}
          </span>
          <span className="text-2xl font-light text-gray-500 tabular-nums ml-1">
            :{secs}
          </span>
        </div>
        <button
          onClick={onToggle}
          title={trackingActive ? "Pause tracking" : "Resume tracking"}
          className="text-gray-600 hover:text-gray-200 transition-all opacity-40 hover:opacity-100 hover:scale-110 self-center"
        >
          {trackingActive ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
      </div>

      {/* Project + flow */}
      <div className="flex items-center gap-3 mt-1">
        {!trackingActive && (
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-white/[0.04] border border-white/[0.06] text-gray-400">
            Paused
          </span>
        )}
        {session.project && (
          <span className="text-sm font-medium" style={{ color: trackingActive ? color : undefined }}>
            {session.project}
          </span>
        )}
        {flowStatus.in_flow && trackingActive && (
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 animate-glow">
            ✦ In Flow
          </span>
        )}
      </div>
    </div>
  );
}

function IdleSummary() {
  return (
    <div className="flex flex-col items-center gap-4 select-none max-w-sm text-center">
      {/* Animated concentric rings */}
      <div className="relative w-24 h-24 mb-2">
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border border-indigo-500/10 animate-ring-pulse"
          style={{ animationDelay: "0s" }}
        />
        {/* Middle ring */}
        <div
          className="absolute inset-2 rounded-full border border-purple-500/15 animate-ring-pulse"
          style={{ animationDelay: "1s" }}
        />
        {/* Inner ring */}
        <div
          className="absolute inset-4 rounded-full border border-indigo-400/20 animate-ring-pulse"
          style={{ animationDelay: "2s" }}
        />
        {/* Core */}
        <div className="absolute inset-5 rounded-full bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center backdrop-blur-sm">
          <span className="text-xl font-light text-indigo-400/80">C</span>
        </div>
        {/* Glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/5 to-purple-500/5 blur-xl" />
      </div>

      <h2 className="text-lg font-light text-white/80">Chronos AI</h2>

      <p className="text-sm text-gray-400 leading-relaxed">
        Waiting for window activity.
      </p>

      <div className="mt-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left space-y-2.5">
        <p className="text-xs text-gray-400">
          <span className="text-amber-400/80">Tip:</span> Grant <strong className="text-gray-300">Accessibility</strong> permission in System Settings {"\u2192"} Privacy & Security for window tracking.
        </p>
        <div className="flex flex-wrap gap-2">
          <kbd className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 font-mono">
            {"\u2318"}+Shift+T
          </kbd>
          <span className="text-[10px] text-gray-500 self-center">overlay</span>
          <kbd className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 font-mono">
            {"\u2318"}K
          </kbd>
          <span className="text-[10px] text-gray-500 self-center">AI</span>
          <kbd className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 font-mono">
            {"\u2318"}{"\u21E7"}K
          </kbd>
          <span className="text-[10px] text-gray-500 self-center">commands</span>
        </div>
      </div>
    </div>
  );
}



export default function Dashboard() {
  const { events, loading } = useEvents();
  const flowStatus = useFlowState();
  const [trackingActive, setTrackingActive] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setTrackingActive(await api.getTrackingActive());
      } catch { }
    };
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    const nowActive = await api.toggleTracking();
    setTrackingActive(nowActive);
  };

  const sessions = useMemo(() => aggregateToSessions(events), [events]);

  const currentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    const last = sessions[sessions.length - 1];
    const lastEvent = last.events[last.events.length - 1];
    if (!lastEvent.end_time) return last;
    return null;
  }, [sessions]);

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const cat = e.category || "unknown";
      map[cat] = (map[cat] || 0) + e.duration_seconds;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, seconds]) => ({
        category: cat as Category,
        label: CATEGORY_LABELS[cat as Category] || cat,
        seconds,
      }));
  }, [events]);

  const leakage = useMemo(() => computeLeakage(events), [events]);

  const goalSeconds = 8 * 3600;
  const progressPct = Math.min(100, (totalSeconds / goalSeconds) * 100);
  const progressHours = Math.floor(totalSeconds / 3600);
  const progressMins = Math.floor((totalSeconds % 3600) / 60);

  const categoryColor = currentSession
    ? CATEGORY_COLORS[currentSession.category] || CATEGORY_COLORS.unknown
    : null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-32 h-1 bg-white/[0.03] rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-indigo-500/40 rounded-full animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Ambient category glow */}
      {categoryColor && trackingActive && (
        <div
          className="pulse-bg transition-all duration-[3000ms]"
          style={{ "--pulse-color": categoryColor } as React.CSSProperties}
        />
      )}

      {/* Progress bar — full width, top */}
      <div className="relative z-10 px-8 pt-6 animate-slide-up" style={{ animationDelay: "0s" }}>
        <div className="flex items-center justify-between mb-2">
          <div />
          <span className="text-xs text-gray-500 tabular-nums font-mono">
            {progressHours > 0 ? `${progressHours}h ${progressMins}m` : `${progressMins}m`} / 8h
            {leakage.gapSeconds > 300 && (
              <span className="text-amber-500/60 ml-2">
                {"\u00B7"} {formatGapDuration(leakage.gapSeconds)} untracked
              </span>
            )}
          </span>
        </div>
        <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 relative"
            style={{ width: `${progressPct}%` }}
          >
            {/* Glow at the tip */}
            {progressPct > 2 && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-purple-400/40 blur-sm" />
            )}
          </div>
        </div>
      </div>

      {/* Center — the pulse + category race */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 gap-6 px-8">
        {currentSession ? (
          <>
            <ActivePulse
              session={currentSession}
              flowStatus={flowStatus}
              trackingActive={trackingActive}
              onToggle={handleToggle}
            />
            <CategoryRace
              categories={categoryTotals}
              activeCategory={currentSession.category}
              totalSeconds={totalSeconds}
            />
          </>
        ) : totalSeconds > 0 ? (
          <>
            <div className="text-center">
              <span
                className="text-[64px] leading-none font-light text-white tabular-nums tracking-tight"
                style={{ textShadow: "0 0 40px rgba(255, 255, 255, 0.05)" }}
              >
                {formatDuration(totalSeconds)}
              </span>
              <p className="text-sm text-gray-400 mt-2">tracked today</p>
            </div>
            <CategoryRace
              categories={categoryTotals}
              activeCategory={null}
              totalSeconds={totalSeconds}
            />
          </>
        ) : (
          <IdleSummary />
        )}
      </div>

      {/* Bottom — timeline ribbon */}
      <div className="relative z-10 px-8 pb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        {events.length > 0 && <TimelineBar events={events} />}
      </div>
    </div>
  );
}
