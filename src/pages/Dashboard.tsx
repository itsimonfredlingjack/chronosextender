import { useMemo } from "react";
import { useEvents } from "../hooks/useEvents";
import { useFlowState } from "../hooks/useFlowState";
import { useLiveTimer, formatLiveDuration } from "../lib/time";
import { aggregateToSessions, formatDuration } from "../lib/sessions";
import { computeLeakage, formatGapDuration } from "../lib/leakage";
import TimelineBar from "../components/TimelineBar";
import CategoryRace from "../components/CategoryRace";
import type { Category, Session } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";

function ActivePulse({
  session,
  flowStatus,
}: {
  session: Session;
  flowStatus: { in_flow: boolean };
}) {
  const color = CATEGORY_COLORS[session.category] || CATEGORY_COLORS.unknown;
  const label = CATEGORY_LABELS[session.category] || "Unknown";
  const liveElapsed = useLiveTimer(session.start_time);
  const { main, secs } = formatLiveDuration(liveElapsed);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Category indicator */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="relative">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: color }}
          />
        </div>
        <span className="text-sm font-medium tracking-wide uppercase" style={{ color }}>
          {label}
        </span>
      </div>

      {/* App name */}
      <span className="text-base text-gray-500 mb-2">
        {session.apps[0]}
        {session.apps.length > 1 && (
          <span className="text-gray-600"> + {session.apps.length - 1}</span>
        )}
      </span>

      {/* THE timer */}
      <div className="flex items-baseline">
        <span className="text-[72px] leading-none font-extralight text-white tabular-nums tracking-tight">
          {main}
        </span>
        <span className="text-2xl font-extralight text-gray-600 tabular-nums ml-1">
          :{secs}
        </span>
      </div>

      {/* Project + flow */}
      <div className="flex items-center gap-3 mt-1">
        {session.project && (
          <span className="text-sm font-medium" style={{ color }}>
            {session.project}
          </span>
        )}
        {flowStatus.in_flow && (
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-white/[0.04] border border-white/[0.06] text-indigo-300">
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
      {/* Breathing orb */}
      <div className="relative w-20 h-20 mb-2">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 animate-breathe" />
        <div className="absolute inset-3 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 animate-breathe" style={{ animationDelay: "0.5s" }} />
        <div className="absolute inset-6 rounded-full bg-[#0a0a14] flex items-center justify-center">
          <span className="text-xl text-indigo-400/60">C</span>
        </div>
      </div>

      <h2 className="text-lg font-light text-white/80">Chronos AI</h2>

      <p className="text-sm text-gray-500 leading-relaxed">
        Waiting for window activity.
      </p>

      <div className="mt-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-left space-y-2">
        <p className="text-xs text-gray-400">
          <span className="text-amber-400/80">Tip:</span> Grant <strong className="text-gray-300">Accessibility</strong> permission in System Settings {"\u2192"} Privacy & Security for window tracking.
        </p>
        <p className="text-xs text-gray-500">
          {"\u2318"}+Shift+T for quick overlay {" \u00B7 "} {"\u2318"}K for AI {" \u00B7 "} {"\u2318"}{"\u21E7"}K for commands
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { events, loading } = useEvents();
  const flowStatus = useFlowState();

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
      {categoryColor && (
        <div
          className="pulse-bg transition-all duration-[3000ms]"
          style={{ "--pulse-color": categoryColor } as React.CSSProperties}
        />
      )}

      {/* Progress bar — full width, top */}
      <div className="relative z-10 px-8 pt-6">
        <div className="flex items-center justify-between mb-2">
          <div />
          <span className="text-xs text-gray-600 tabular-nums">
            {progressHours > 0 ? `${progressHours}h ${progressMins}m` : `${progressMins}m`} / 8h
            {leakage.gapSeconds > 300 && (
              <span className="text-amber-500/60 ml-2">
                {"\u00B7"} {formatGapDuration(leakage.gapSeconds)} untracked
              </span>
            )}
          </span>
        </div>
        <div className="h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Center — the pulse + category race */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 gap-6 px-8">
        {currentSession ? (
          <>
            <ActivePulse session={currentSession} flowStatus={flowStatus} />
            <CategoryRace
              categories={categoryTotals}
              activeCategory={currentSession.category}
              totalSeconds={totalSeconds}
            />
          </>
        ) : totalSeconds > 0 ? (
          <>
            <div className="text-center">
              <span className="text-[64px] leading-none font-extralight text-white tabular-nums tracking-tight">
                {formatDuration(totalSeconds)}
              </span>
              <p className="text-sm text-gray-500 mt-2">tracked today</p>
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
      <div className="relative z-10 px-8 pb-6">
        {events.length > 0 && <TimelineBar events={events} />}
      </div>
    </div>
  );
}
