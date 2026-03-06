import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  createNavActions,
  createToggleActions,
  createClassifyActions,
  filterCommands,
} from "../lib/commands";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const actions = useMemo(
    () => [
      ...createNavActions(navigate, onClose),
      ...createToggleActions(onClose),
      ...createClassifyActions(onClose),
    ],
    [navigate, onClose]
  );

  const filtered = useMemo(
    () => filterCommands(actions, query),
    [actions, query]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

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
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg bg-[#1a1a2e] rounded-xl border border-[#2a2a40] shadow-2xl overflow-hidden animate-[fade-in_0.15s_ease-out]">
        {/* Search */}
        <div className="flex items-center gap-3 px-4 border-b border-[#2a2a40]">
          <span className="text-gray-500 text-sm">{"\u2318"}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 py-3 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded bg-[#12121e] text-gray-500 border border-[#2a2a40]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">
              No matching commands
            </p>
          ) : (
            filtered.map((action, i) => (
              <button
                key={action.id}
                onClick={() => action.execute()}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                  i === selectedIndex
                    ? "bg-indigo-500/10 text-indigo-300"
                    : "text-gray-300 hover:bg-[#22223a]/50"
                }`}
              >
                <span className="text-base w-6 text-center shrink-0">
                  {action.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{action.label}</p>
                  {action.description && (
                    <p className="text-xs text-gray-400 truncate">
                      {action.description}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#2a2a40] flex gap-3 text-xs text-gray-500">
          <span>{"\u2191\u2193"} navigate</span>
          <span>{"\u21B5"} select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
