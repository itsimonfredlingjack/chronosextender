import { useState, useEffect, useCallback } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useOllamaStatus } from "../hooks/useOllamaStatus";
import CommandPalette from "./CommandPalette";

export default function Layout() {
  const ollamaStatus = useOllamaStatus();
  const [cmdOpen, setCmdOpen] = useState(false);
  const closePalette = useCallback(() => setCmdOpen(false), []);
  const location = useLocation();
  const isHome = location.pathname === "/" || location.pathname === "/dashboard";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen bg-[#0a0a14] overflow-hidden relative">
      {/* Minimal top bar — only on sub-pages */}
      {!isHome && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
          <NavLink
            to="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2"
          >
            <span className="text-xs">{"\u2190"}</span>
            <span>Back</span>
          </NavLink>
        </div>
      )}

      {/* Full-bleed content */}
      <main className="h-full">
        <Outlet />
      </main>

      {/* Floating indicators */}
      <div className="fixed bottom-5 right-5 z-30 flex items-center gap-3">
        {/* Ollama status dot */}
        <div className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              ollamaStatus.connected ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
          <span className="text-[10px] text-gray-500 hidden hover:inline">
            {ollamaStatus.connected ? "AI" : "Offline"}
          </span>
        </div>

        {/* Command palette trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-white/[0.08] hover:text-gray-300 transition-all backdrop-blur-sm"
        >
          <span>{"\u2318"}K</span>
        </button>
      </div>

      <CommandPalette isOpen={cmdOpen} onClose={closePalette} />
    </div>
  );
}
