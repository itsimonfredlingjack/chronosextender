import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  ollamaConnected: boolean;
  trackingActive: boolean;
  pendingCount: number;
  onToggleTracking: () => void;
  onClose: () => void;
  isOpen: boolean;
  onOpen: () => void;
}

function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1.5" y="1" width="3.5" height="10" rx="1" />
      <rect x="7" y="1" width="3.5" height="10" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
    </svg>
  );
}

export default function StatusPopover({
  ollamaConnected,
  trackingActive,
  pendingCount,
  onToggleTracking,
  onClose,
  isOpen,
  onOpen,
}: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // Health priority: red > amber > green
  const health: "red" | "amber" | "green" = !ollamaConnected
    ? "red"
    : !trackingActive || pendingCount > 0
      ? "amber"
      : "green";

  const dotColors = {
    green: "bg-emerald-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
  };

  const pillLabel =
    health === "red"
      ? "Offline"
      : pendingCount > 0
        ? `${pendingCount} pending`
        : !trackingActive
          ? "Paused"
          : "All good";

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      {/* Health indicator button — compact for sidebar */}
      <button
        onClick={() => (isOpen ? onClose() : onOpen())}
        className="sidebar-link relative"
        title={pillLabel}
      >
        <span className={`w-2 h-2 rounded-full ${dotColors[health]}`} />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-amber-950 flex items-center justify-center">
            {pendingCount}
          </span>
        )}
        <span className="sidebar-tooltip">{pillLabel}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-12 bottom-0 w-52 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-[0_18px_42px_rgba(30,41,59,0.22)] overflow-hidden z-50">
          {/* Ollama row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <span className={`w-2 h-2 rounded-full shrink-0 ${ollamaConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-xs text-slate-700 flex-1">Ollama</span>
            <span className={`text-xs ${ollamaConnected ? "text-emerald-600" : "text-red-600"}`}>
              {ollamaConnected ? "Connected" : "Offline"}
            </span>
          </div>

          {/* Tracking row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <span className={`w-2 h-2 rounded-full shrink-0 ${trackingActive ? "bg-indigo-500" : "bg-slate-400"}`} />
            <span className="text-xs text-slate-700 flex-1">Tracking</span>
            <button
              onClick={() => { onToggleTracking(); }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              {trackingActive ? (
                <><PauseIcon /><span>Pause</span></>
              ) : (
                <><PlayIcon /><span>Resume</span></>
              )}
            </button>
          </div>

          {/* Review row */}
          <button
            onClick={() => { navigate("/review"); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-elevated)] transition-colors text-left"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${pendingCount > 0 ? "bg-amber-500" : "bg-slate-400"}`} />
            <span className="text-xs text-slate-700 flex-1">Review</span>
            <span className={`text-xs ${pendingCount > 0 ? "text-amber-600" : "text-slate-500"}`}>
              {pendingCount > 0 ? `${pendingCount} items` : "Clear"}
            </span>
            <span className="text-slate-500 text-xs">›</span>
          </button>
        </div>
      )}
    </div>
  );
}
