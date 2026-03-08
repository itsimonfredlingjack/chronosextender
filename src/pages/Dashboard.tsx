import { useMemo, type CSSProperties } from "react";

import CategoryRace from "../components/CategoryRace";
import MissionTimeline from "../components/MissionTimeline";
import TimelineBar from "../components/TimelineBar";
import { useCommandDeckState } from "../hooks/useCommandDeckState";
import { useEvents } from "../hooks/useEvents";
import { buildMissionTimeline } from "../lib/missionTimeline";
import { aggregateToSessions, formatDuration } from "../lib/sessions";
import { api } from "../lib/tauri";
import { formatLiveDuration, useLiveTimer } from "../lib/time";
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
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div
            className={`w-2.5 h-2.5 rounded-full ${trackingActive ? "" : "bg-slate-400"}`}
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
          className={`text-xs font-semibold tracking-[0.12em] uppercase ${trackingActive ? "" : "text-slate-500"}`}
          style={trackingActive ? { color } : undefined}
        >
          {label}
        </span>
      </div>

      <span className="text-sm text-slate-500">
        {session.apps[0]}
        {session.apps.length > 1 && (
          <span className="text-slate-500"> + {session.apps.length - 1}</span>
        )}
      </span>

      <div className="flex items-end gap-4">
        <div className="flex items-baseline">
          <span
            className="text-[56px] md:text-[74px] leading-none text-slate-900 tracking-tight font-display"
            style={{ textShadow: "0 10px 30px rgba(30, 41, 59, 0.12)" }}
          >
            {main}
          </span>
          <span className="text-2xl text-slate-500 ml-1 font-data">:{secs}</span>
        </div>
        <button
          onClick={onToggle}
          title={trackingActive ? "Pause tracking" : "Resume tracking"}
          className="text-slate-500 hover:text-slate-700 transition-all opacity-70 hover:opacity-100 hover:scale-110 mb-3"
        >
          {trackingActive ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
      </div>

      <div className="flex items-center gap-3 mt-1">
        {!trackingActive && (
          <span className="state-chip state-chip-paused">
            Paused
          </span>
        )}
        {session.project && (
          <span className="text-sm font-medium" style={{ color: trackingActive ? color : undefined }}>
            {session.project}
          </span>
        )}
        {flowStatus.in_flow && trackingActive && (
          <span className="state-chip state-chip-flow">
            In Flow
          </span>
        )}
      </div>
    </div>
  );
}

function IdleSummary() {
  return (
    <div className="flex flex-col items-center gap-4 select-none max-w-sm text-center">
      <div className="relative w-24 h-24 mb-2">
        <div
          className="absolute inset-0 rounded-full border border-indigo-500/10 animate-ring-pulse"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="absolute inset-2 rounded-full border border-blue-500/15 animate-ring-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute inset-4 rounded-full border border-indigo-400/20 animate-ring-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute inset-5 rounded-full bg-gradient-to-br from-indigo-500/18 to-blue-500/18 border border-indigo-400/20 flex items-center justify-center backdrop-blur-sm">
          <span className="text-xl text-indigo-600/80 font-display">C</span>
        </div>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/10 to-blue-500/8 blur-xl" />
      </div>

      <h2 className="text-lg text-slate-700 font-display">Chronos AI</h2>

      <p className="text-sm text-slate-500 leading-relaxed">
        Waiting for window activity.
      </p>

      <div className="mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-left space-y-2.5">
        <p className="text-xs text-slate-600">
          <span className="text-amber-600">Tip:</span> Grant <strong className="text-slate-800">Accessibility</strong> permission in System Settings {"\u2192"} Privacy & Security for window tracking.
        </p>
        <div className="flex flex-wrap gap-2">
          <kbd className="text-[10px] px-2 py-1 rounded-md bg-[var(--color-elevated)] border border-[var(--color-border)] text-slate-600 font-data">
            {"\u2318"}+Shift+T
          </kbd>
          <span className="text-[10px] text-slate-500 self-center">overlay</span>
          <kbd className="text-[10px] px-2 py-1 rounded-md bg-[var(--color-elevated)] border border-[var(--color-border)] text-slate-600 font-data">
            {"\u2318"}K
          </kbd>
          <span className="text-[10px] text-slate-500 self-center">AI</span>
          <kbd className="text-[10px] px-2 py-1 rounded-md bg-[var(--color-elevated)] border border-[var(--color-border)] text-slate-600 font-data">
            {"\u2318"}{"\u21E7"}K
          </kbd>
          <span className="text-[10px] text-slate-500 self-center">commands</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { events, loading } = useEvents();
  const {
    flowStatus,
    trackingActive,
    visualState,
    statusLabel,
    setTrackingActive,
    refreshStatus,
  } = useCommandDeckState();

  const sessions = useMemo(() => aggregateToSessions(events), [events]);

  const currentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    const last = sessions[sessions.length - 1];
    const lastEvent = last.events[last.events.length - 1];
    if (!lastEvent.end_time) return last;
    return null;
  }, [sessions]);

  const totalSeconds = events.reduce((sum, event) => sum + event.duration_seconds, 0);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const event of events) {
      const category = event.category || "unknown";
      map[category] = (map[category] || 0) + event.duration_seconds;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([category, seconds]) => ({
        category: category as Category,
        label: CATEGORY_LABELS[category as Category] || category,
        seconds,
      }));
  }, [events]);

  const timeline = useMemo(
    () =>
      buildMissionTimeline({
        events,
        trackingActive: trackingActive ?? true,
        flowStatus,
      }),
    [events, flowStatus, trackingActive]
  );

  const trackingIsActive = trackingActive ?? true;
  const categoryColor = currentSession
    ? CATEGORY_COLORS[currentSession.category] || CATEGORY_COLORS.unknown
    : null;

  const handleToggle = async () => {
    const next = await api.toggleTracking();
    setTrackingActive(next);
    void refreshStatus();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-32 h-1 bg-[var(--color-elevated)] rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-indigo-500/35 rounded-full animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell h-full flex flex-col relative overflow-hidden">
      {categoryColor && trackingIsActive && (
        <div
          className="pulse-bg transition-all duration-[3000ms]"
          style={{ "--pulse-color": categoryColor } as CSSProperties}
        />
      )}

      <div className="dashboard-top-strip relative z-10 px-3 sm:px-6 pt-2 sm:pt-4 animate-slide-up" style={{ animationDelay: "0s" }}>
        <MissionTimeline
          visualState={visualState}
          statusLabel={statusLabel}
          segments={timeline.segments}
          totals={timeline.totals}
          playheadPct={timeline.playheadPct}
        />
      </div>

      <div className="dashboard-main-stage flex-1 flex flex-col items-center justify-center relative z-10 gap-4 sm:gap-6 px-4 sm:px-8">
        {currentSession ? (
          <>
            <ActivePulse
              session={currentSession}
              flowStatus={flowStatus}
              trackingActive={trackingIsActive}
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
                className="text-[56px] md:text-[64px] leading-none text-slate-900 tracking-tight font-display"
                style={{ textShadow: "0 10px 30px rgba(30, 41, 59, 0.1)" }}
              >
                {formatDuration(totalSeconds)}
              </span>
              <p className="text-sm text-slate-500 mt-2">tracked today</p>
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

      <div className="dashboard-bottom-ribbon relative z-10 px-4 sm:px-8 pb-4 sm:pb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        {events.length > 0 && <TimelineBar events={events} />}
      </div>
    </div>
  );
}
