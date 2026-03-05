import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/tauri";
import type { FlowStatus } from "../lib/types";

export function useFlowState() {
  const [flowStatus, setFlowStatus] = useState<FlowStatus>({
    in_flow: false,
    current_app: null,
    duration_minutes: 0,
    flow_start: null,
  });

  useEffect(() => {
    api.getFlowStatus().then(setFlowStatus).catch(console.error);

    const unlistenFlow = listen<boolean>("flow-state-changed", (event) => {
      setFlowStatus((prev) => ({ ...prev, in_flow: event.payload }));
    });

    // Refresh every 10s for duration updates
    const interval = setInterval(() => {
      api.getFlowStatus().then(setFlowStatus).catch(console.error);
    }, 10000);

    return () => {
      unlistenFlow.then((fn) => fn());
      clearInterval(interval);
    };
  }, []);

  return flowStatus;
}
