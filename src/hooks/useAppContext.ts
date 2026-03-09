import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useLocation } from "react-router-dom";
import { api } from "../lib/tauri";
import { buildAssistantContext } from "../lib/ai/context";
import type { AssistantContextSnapshot } from "../types/ai-types";

function getCurrentView(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") {
    return "dashboard";
  }
  if (pathname.startsWith("/reports") || pathname.startsWith("/timesheets")) {
    return "timesheets";
  }
  return pathname.replace(/^\//, "") || "dashboard";
}

export function useAppContext() {
  const location = useLocation();
  const currentView = getCurrentView(location.pathname);
  const [snapshot, setSnapshot] = useState<AssistantContextSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const nextSnapshot = await api.getAssistantContextSnapshot();
        if (mounted) {
          setSnapshot(nextSnapshot);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to build assistant context:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    refresh();
    const interval = setInterval(refresh, 15000);
    const unlistenEvents = listen("events-changed", refresh);
    const unlistenFlow = listen("flow-state-changed", refresh);

    return () => {
      mounted = false;
      clearInterval(interval);
      unlistenEvents.then((fn) => fn());
      unlistenFlow.then((fn) => fn());
    };
  }, [currentView]);

  return {
    currentView,
    loading,
    snapshot,
    contextXml: snapshot ? buildAssistantContext({ currentView, snapshot }) : "",
  };
}
