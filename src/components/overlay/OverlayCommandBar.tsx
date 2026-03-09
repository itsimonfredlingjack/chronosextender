import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../../lib/tauri";
import { filterCommands, type CommandAction } from "../../lib/commands";

interface Props {
  pendingCount: number;
  trackingActive: boolean;
  onDismiss: () => void;
}

export default function OverlayCommandBar({ pendingCount, trackingActive, onDismiss }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo<CommandAction[]>(() => {
    const items: CommandAction[] = [];

    if (pendingCount > 0) {
      items.push({
        id: "review-blocks",
        label: `Resolve ${pendingCount} attention item${pendingCount === 1 ? "" : "s"}`,
        icon: "\u25B8",
        keywords: ["review", "attention", "check", "confirm", "resolve"],
        execute: async () => {
          await api.showDashboard();
          onDismiss();
        },
      });
    }

    items.push(
      {
        id: "open-dashboard",
        label: "Open Today",
        icon: "\u25C9",
        keywords: ["dashboard", "today", "open", "main", "window"],
        execute: async () => {
          await api.showDashboard();
          onDismiss();
        },
      },
      {
        id: "toggle-tracking",
        label: trackingActive ? "Pause Tracking" : "Resume Tracking",
        description: trackingActive ? "Stop recording time" : "Continue recording time",
        icon: trackingActive ? "\u23F8" : "\u25B6",
        keywords: ["tracking", "pause", "resume", "toggle", "stop", "start", "break"],
        execute: async () => {
          await api.toggleTracking();
          onDismiss();
        },
      },
      {
        id: "todays-report",
        label: "Open Main Window",
        icon: "\u25A4",
        keywords: ["main", "window", "dashboard", "today"],
        execute: async () => {
          await api.showDashboard();
          onDismiss();
        },
      },
    );

    return items;
  }, [pendingCount, trackingActive, onDismiss]);

  const filtered = useMemo(
    () => filterCommands(actions, query, 6),
    [actions, query]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].execute();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (query) {
          setQuery("");
        } else {
          onDismiss();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, onDismiss, query]);

  return (
    <div>
      <div className="mx-5 border-t border-[var(--color-border)]" />

      <div className="flex items-center gap-3 px-5 py-2">
        <span className="text-slate-500 text-xs">{"\u2318"}</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="pause, resolve, AI pass..."
          className="flex-1 py-1 bg-transparent text-sm text-slate-900 placeholder-slate-500 outline-none"
        />
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-slate-500 border border-[var(--color-border)]">
          ESC
        </kbd>
      </div>

      <div className="max-h-[192px] overflow-auto">
        {filtered.map((action, i) => (
          <button
            key={action.id}
            onClick={() => action.execute()}
            className={`w-full px-5 py-2 flex items-center gap-3 text-left transition-colors ${
              i === selectedIndex
                ? "bg-indigo-500/12 text-indigo-700"
                : "text-slate-700 hover:bg-[var(--color-elevated)]"
            }`}
          >
            <span className="text-sm w-5 text-center shrink-0">{action.icon}</span>
            <span className="flex-1 text-sm truncate">{action.label}</span>
            {action.description && (
              <span className="text-xs text-slate-500">{action.description}</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-5 py-2 flex gap-3 text-[10px] text-slate-500 border-t border-[var(--color-border)]">
        <span>{"\u2191\u2193"} navigate</span>
        <span>{"\u21B5"} select</span>
        <span>esc close</span>
      </div>
    </div>
  );
}
