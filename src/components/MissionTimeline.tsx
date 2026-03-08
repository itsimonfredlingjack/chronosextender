import { formatDuration } from "../lib/sessions";
import type { TimelineSegment, TimelineSegmentType, UIVisualState } from "../lib/types";
import { UI_VISUAL_STATE_META } from "../lib/visualState";

interface MissionTimelineProps {
  visualState: UIVisualState;
  statusLabel: string;
  segments: TimelineSegment[];
  totals: {
    trackedSeconds: number;
    flowSeconds: number;
    untrackedSeconds: number;
    pausedSeconds: number;
  };
  playheadPct: number;
}

const segmentClassByType: Record<TimelineSegmentType, string> = {
  tracked: "mission-segment mission-segment-tracked",
  flow: "mission-segment mission-segment-flow",
  untracked: "mission-segment mission-segment-untracked",
  paused: "mission-segment mission-segment-paused",
};

export default function MissionTimeline({
  visualState,
  statusLabel,
  segments,
  totals,
  playheadPct,
}: MissionTimelineProps) {
  const tracked = totals.trackedSeconds + totals.flowSeconds;
  const stateMeta = UI_VISUAL_STATE_META[visualState];

  return (
    <section className={`mission-timeline-shell ${stateMeta.glowClassName}`}>
      <div className="mission-timeline-header">
        <div>
          <p className="mission-eyebrow">Command Deck</p>
          <h1 className="mission-title font-display">Mission timeline</h1>
        </div>
        <span className={stateMeta.chipClassName}>{statusLabel}</span>
      </div>

      <div className="mission-metrics font-data">
        <span>
          Tracked <strong>{formatDuration(tracked)}</strong>
        </span>
        <span>
          Flow <strong>{formatDuration(totals.flowSeconds)}</strong>
        </span>
        <span>
          Untracked <strong>{formatDuration(totals.untrackedSeconds)}</strong>
        </span>
      </div>

      <div className="mission-track" role="img" aria-label="Mission timeline by activity state">
        {segments.map((segment, index) => (
          <div
            key={`${segment.type}-${index}`}
            className={segmentClassByType[segment.type]}
            style={{
              left: `${segment.startPct}%`,
              width: `${Math.max(0.8, segment.endPct - segment.startPct)}%`,
            }}
            title={`${segment.type}: ${formatDuration(segment.durationSeconds)}`}
          />
        ))}
        <div className="mission-playhead" style={{ left: `${playheadPct}%` }} />
      </div>

      <div className="mission-legend" aria-hidden>
        <span className="mission-legend-item">
          <i className="mission-dot mission-dot-tracked" /> tracked
        </span>
        <span className="mission-legend-item">
          <i className="mission-dot mission-dot-flow" /> flow
        </span>
        <span className="mission-legend-item">
          <i className="mission-dot mission-dot-untracked" /> untracked
        </span>
        <span className="mission-legend-item">
          <i className="mission-dot mission-dot-paused" /> paused
        </span>
      </div>
    </section>
  );
}
