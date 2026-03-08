import type { UIVisualState } from "./types";

export interface UIVisualStateInput {
  ollamaConnected?: boolean | null;
  trackingActive?: boolean | null;
  pendingCount?: number | null;
  inFlow?: boolean | null;
}

interface UIVisualStateMeta {
  label: string;
  chipClassName: string;
  glowClassName: string;
}

export const UI_VISUAL_STATE_META: Record<UIVisualState, UIVisualStateMeta> = {
  normal: {
    label: "All systems normal",
    chipClassName: "state-chip state-chip-normal",
    glowClassName: "state-glow-normal",
  },
  flow: {
    label: "In flow",
    chipClassName: "state-chip state-chip-flow",
    glowClassName: "state-glow-flow",
  },
  warning: {
    label: "Needs attention",
    chipClassName: "state-chip state-chip-warning",
    glowClassName: "state-glow-warning",
  },
  critical: {
    label: "System offline",
    chipClassName: "state-chip state-chip-critical",
    glowClassName: "state-glow-critical",
  },
  paused: {
    label: "Tracking paused",
    chipClassName: "state-chip state-chip-paused",
    glowClassName: "state-glow-paused",
  },
  unknown: {
    label: "Status unavailable",
    chipClassName: "state-chip state-chip-unknown",
    glowClassName: "state-glow-unknown",
  },
};

export function resolveUIVisualState({
  ollamaConnected,
  trackingActive,
  pendingCount,
  inFlow,
}: UIVisualStateInput): UIVisualState {
  if (typeof trackingActive !== "boolean") {
    return "unknown";
  }

  if (ollamaConnected === false) {
    return "critical";
  }

  if (typeof pendingCount === "number" && pendingCount > 0) {
    return "warning";
  }

  if (!trackingActive) {
    return "paused";
  }

  if (inFlow === true) {
    return "flow";
  }

  return "normal";
}

export function getVisualStateLabel(
  state: UIVisualState,
  input: UIVisualStateInput = {}
): string {
  if (state === "warning" && typeof input.pendingCount === "number" && input.pendingCount > 0) {
    return `${input.pendingCount} item${input.pendingCount === 1 ? "" : "s"} need review`;
  }

  return UI_VISUAL_STATE_META[state].label;
}
