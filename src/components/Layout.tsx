import { useState, useEffect, useCallback } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { useOllamaStatus } from "../hooks/useOllamaStatus";
import {
  getAssistantPopoverDotClassName,
  getAssistantPopoverValue,
  useAssistantStatus,
} from "../hooks/useAssistantStatus";
import { api } from "../lib/tauri";
import type { CloudSyncStatus, Settings } from "../lib/types";
import CommandPalette from "./CommandPalette";
import { AIChatPanel } from "./ai-chat/AIChatPanel";
import StatusPopover from "./StatusPopover";

export default function Layout() {
  const ollamaStatus = useOllamaStatus();
  const assistantStatus = useAssistantStatus();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const closePalette = useCallback(() => setCmdOpen(false), []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);
  const [trackingActive, setTrackingActive] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus | null>(null);
  const [appSettings, setAppSettings] = useState<Settings | null>(null);
  const location = useLocation();

  useEffect(() => {
    const fetchPending = () => {
      api.getPendingCount().then(setPendingCount).catch(() => { });
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
      } catch { }
    };
    fetchTracking();
    const interval = setInterval(fetchTracking, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;

    const refreshAppStatus = async () => {
      try {
        const [settings, syncStatus] = await Promise.all([
          api.getSettings(),
          api.getCloudSyncStatus(),
        ]);
        if (!mounted) return;
        setAppSettings(settings);
        setCloudStatus(syncStatus);
      } catch {
        if (!mounted) return;
        setCloudStatus(null);
      }
    };

    void refreshAppStatus();
    const interval = setInterval(() => {
      void refreshAppStatus();
    }, 15000);

    const unlisten = listen("settings-updated", refreshAppStatus);

    return () => {
      mounted = false;
      clearInterval(interval);
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleToggleTracking = async () => {
    const nowActive = await api.toggleTracking();
    setTrackingActive(nowActive);
  };

  const closeStatus = useCallback(() => setStatusOpen(false), []);

  const tabs = [
    { to: "/", label: "Pulse", icon: "◉", end: true },
    { to: "/review", label: "Review", icon: "☰" },
    { to: "/timesheets", label: "Timesheets", icon: "▤" },
    { to: "/settings", label: "Settings", icon: "⚙" },
  ];

  return (
    <div className="h-screen bg-base overflow-hidden relative flex">
      {/* Mesh gradient background */}
      <div className="mesh-bg" />

      {/* Left sidebar */}
      <aside className="relative z-10 w-14 flex flex-col items-center pt-3 pb-3 border-r border-border/50 bg-base/80 backdrop-blur-sm shrink-0">
        {/* Nav links */}
        <nav className="flex flex-col items-center gap-1.5 flex-1 mt-1">
          {tabs.map((tab) => {
            const isActive =
              tab.end
                ? location.pathname === tab.to || location.pathname === "/dashboard"
                : tab.to === "/timesheets"
                  ? location.pathname.startsWith("/timesheets") || location.pathname.startsWith("/reports")
                  : location.pathname.startsWith(tab.to);

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <span>{tab.icon}</span>
                <span className="sidebar-tooltip">{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <button
            onClick={() => {
              setCmdOpen(false);
              setStatusOpen(false);
              setAssistantOpen(true);
            }}
            className="sidebar-link"
            title="AI Assistant (⌘K)"
            aria-label="Open AI Assistant"
          >
            <span className="text-[10px] font-semibold tracking-[0.12em] text-indigo-700 font-data">AI</span>
            <span className="sidebar-tooltip">AI Assistant · ⌘K</span>
          </button>

          <StatusPopover
            ollamaConnected={ollamaStatus.connected}
            aiModelLabel={appSettings?.ai.tier1_model ?? null}
            assistantValue={getAssistantPopoverValue(
              assistantStatus.settings,
              assistantStatus.secretStatus,
              assistantStatus.loading
            )}
            assistantDotClassName={getAssistantPopoverDotClassName(
              assistantStatus.settings,
              assistantStatus.secretStatus,
              assistantStatus.loading
            )}
            trackingActive={trackingActive}
            pendingCount={pendingCount}
            cloudStatus={cloudStatus}
            onToggleTracking={handleToggleTracking}
            isOpen={statusOpen}
            onOpen={() => setStatusOpen(true)}
            onClose={closeStatus}
          />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden relative z-10">
        <Outlet />
      </main>

      <CommandPalette isOpen={cmdOpen} onClose={closePalette} />
      <AIChatPanel isOpen={assistantOpen} onClose={closeAssistant} />
    </div>
  );
}
