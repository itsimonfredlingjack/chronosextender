import type { ReactNode } from "react";

import type { UIVisualState } from "../lib/types";
import { UI_VISUAL_STATE_META } from "../lib/visualState";

interface PageTopStripProps {
  title: string;
  subtitle?: string;
  visualState: UIVisualState;
  statusLabel: string;
  rightSlot?: ReactNode;
}

export default function PageTopStrip({
  title,
  subtitle,
  visualState,
  statusLabel,
  rightSlot,
}: PageTopStripProps) {
  const stateMeta = UI_VISUAL_STATE_META[visualState];

  return (
    <div className="page-top-strip animate-slide-up">
      <div>
        <p className="page-eyebrow">Command Deck</p>
        <h2 className="page-title font-display">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <span className={stateMeta.chipClassName}>{statusLabel}</span>
      </div>
    </div>
  );
}
