import { useEffect, useMemo, useState } from "react";

import { useFlowState } from "./useFlowState";
import { useOllamaStatus } from "./useOllamaStatus";
import { api } from "../lib/tauri";
import { getVisualStateLabel, resolveUIVisualState } from "../lib/visualState";

export function useCommandDeckState() {
  const flowStatus = useFlowState();
  const ollamaStatus = useOllamaStatus();
  const [trackingActive, setTrackingActive] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const [tracking, pending] = await Promise.all([
          api.getTrackingActive(),
          api.getPendingCount(),
        ]);
        if (!mounted) return;
        setTrackingActive(tracking);
        setPendingCount(pending);
      } catch {
        if (!mounted) return;
        setTrackingActive(null);
      }
    };

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const refreshStatus = async () => {
    try {
      const [tracking, pending] = await Promise.all([
        api.getTrackingActive(),
        api.getPendingCount(),
      ]);
      setTrackingActive(tracking);
      setPendingCount(pending);
    } catch {
      setTrackingActive(null);
    }
  };

  const visualState = useMemo(
    () =>
      resolveUIVisualState({
        ollamaConnected: ollamaStatus.connected,
        trackingActive,
        pendingCount,
        inFlow: flowStatus.in_flow,
      }),
    [flowStatus.in_flow, ollamaStatus.connected, pendingCount, trackingActive]
  );

  const statusLabel = useMemo(
    () =>
      getVisualStateLabel(visualState, {
        pendingCount,
        trackingActive,
        ollamaConnected: ollamaStatus.connected,
        inFlow: flowStatus.in_flow,
      }),
    [flowStatus.in_flow, ollamaStatus.connected, pendingCount, trackingActive, visualState]
  );

  return {
    flowStatus,
    ollamaConnected: ollamaStatus.connected,
    trackingActive,
    setTrackingActive,
    pendingCount,
    visualState,
    statusLabel,
    refreshStatus,
  };
}
