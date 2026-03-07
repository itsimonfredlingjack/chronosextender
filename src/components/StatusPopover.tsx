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
      <rect x="1.5" y="1" width="3.5" height="10" rx="1"/>
      <rect x="7" y="1" width="3.5" height="10" rx="1"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z"/>
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

  const pillColors = {
    green: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    red: "bg-red-500/15 text-red-400",
  };

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
      {/* Health pill button */}
      <button
        onClick={() => (isOpen ? onClose() : onOpen())}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${pillColors[health]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[health]}`} />
        {pillLabel}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute bottom-8 right-0 w-52 bg-[#1a1a2e] border border-[#2a2a40] rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Ollama row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a40]/50">
            <span className={`w-2 h-2 rounded-full shrink-0 ${ollamaConnected ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-xs text-gray-300 flex-1">Ollama</span>
            <span className={`text-xs ${ollamaConnected ? "text-emerald-400" : "text-red-400"}`}>
              {ollamaConnected ? "Connected" : "Offline"}
            </span>
          </div>

          {/* Tracking row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a40]/50">
            <span className={`w-2 h-2 rounded-full shrink-0 ${trackingActive ? "bg-indigo-400" : "bg-gray-600"}`} />
            <span className="text-xs text-gray-300 flex-1">Tracking</span>
            <button
              onClick={() => { onToggleTracking(); }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
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
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${pendingCount > 0 ? "bg-amber-400" : "bg-gray-600"}`} />
            <span className="text-xs text-gray-300 flex-1">Review</span>
            <span className={`text-xs ${pendingCount > 0 ? "text-amber-400" : "text-gray-600"}`}>
              {pendingCount > 0 ? `${pendingCount} items` : "Clear"}
            </span>
            <span className="text-gray-600 text-xs">›</span>
          </button>
        </div>
      )}
    </div>
  );
}
