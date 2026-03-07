import { useState, useEffect, useCallback } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { useOllamaStatus } from "../hooks/useOllamaStatus";
import { api } from "../lib/tauri";
import CommandPalette from "./CommandPalette";
import { AIChatPanel } from "./ai-chat/AIChatPanel";
import StatusPopover from "./StatusPopover";

export default function Layout() {
  const ollamaStatus = useOllamaStatus();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const closePalette = useCallback(() => setCmdOpen(false), []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);
  const [trackingActive, setTrackingActive] = useState(true);

  useEffect(() => {
    const fetchPending = () => {
      api.getPendingCount().then(setPendingCount).catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 10000);

    const unlisten = listen("events-changed", fetchPending);

    return () => {
      clearInterval(interval);
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && e.shiftKey) {
        e.preventDefault();
        setAssistantOpen(false);
        setCmdOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(false);
        setAssistantOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        setTrackingActive(await api.getTrackingActive());
      } catch {}
    };
    fetchTracking();
    const interval = setInterval(fetchTracking, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleTracking = async () => {
    const nowActive = await api.toggleTracking();
    setTrackingActive(nowActive);
  };

  const closeStatus = useCallback(() => setStatusOpen(false), []);

  const tabs = [
    { to: "/", label: "Pulse", icon: "\u25C9", end: true },
    { to: "/review", label: "Review", icon: "\u2630" },
    { to: "/reports", label: "Reports", icon: "\u25A4" },
    { to: "/settings", label: "Settings", icon: "\u2699" },
  ];

  return (
    <div className="h-screen bg-[#0a0a14] overflow-hidden relative flex flex-col">
      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="h-12 bg-[#0e0e1a] border-t border-[#2a2a40]/50 flex items-center px-2 shrink-0">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors relative ${
                isActive ? "text-indigo-400" : "text-gray-500 hover:text-gray-400"
              }`
            }
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}

        <div className="flex items-center gap-1 px-1">
          <button
            onClick={() => { setCmdOpen(false); setAssistantOpen(true); }}
            className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
          >
            <span>{"\u2318"}K</span>
          </button>
          <StatusPopover
            ollamaConnected={ollamaStatus.connected}
            trackingActive={trackingActive}
            pendingCount={pendingCount}
            onToggleTracking={handleToggleTracking}
            isOpen={statusOpen}
            onOpen={() => setStatusOpen(true)}
            onClose={closeStatus}
          />
        </div>
      </nav>

      <CommandPalette isOpen={cmdOpen} onClose={closePalette} />
      <AIChatPanel isOpen={assistantOpen} onClose={closeAssistant} />
    </div>
  );
}
