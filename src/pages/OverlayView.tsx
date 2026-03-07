import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "../lib/tauri";
import { useOverlayData } from "../hooks/useOverlayData";
import OverlayPulse from "../components/overlay/OverlayPulse";
import OverlayProgressBar from "../components/overlay/OverlayProgressBar";
import OverlayCommandBar from "../components/overlay/OverlayCommandBar";

export default function OverlayView() {
  const { currentSession, flowStatus, pendingCount, totalSeconds, trackingActive: trackingFromHook } = useOverlayData();

  // Local state for instant visual feedback on toggle (hook syncs every 3s)
  const [trackingActive, setTrackingActive] = useState(trackingFromHook);
  useEffect(() => { setTrackingActive(trackingFromHook); }, [trackingFromHook]);

  // Set transparent body for overlay window
  useEffect(() => {
    document.body.classList.add("overlay-window");
    return () => document.body.classList.remove("overlay-window");
  }, []);

  // Dismiss on blur (window loses focus)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        timeout = setTimeout(() => api.hideOverlay(), 100);
      } else {
        clearTimeout(timeout);
      }
    });
    return () => {
      clearTimeout(timeout);
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleToggle = async () => {
    const nowActive = await api.toggleTracking();
    setTrackingActive(nowActive);
  };

  return (
    <div className="overlay-animate-in p-2">
      <div className="overlay-shell">
        <OverlayPulse
          currentSession={currentSession}
          flowStatus={flowStatus}
          trackingActive={trackingActive}
          onToggle={handleToggle}
        />
        <OverlayProgressBar totalSeconds={totalSeconds} pendingCount={pendingCount} />
        <OverlayCommandBar
          pendingCount={pendingCount}
          trackingActive={trackingActive}
          onDismiss={() => api.hideOverlay()}
        />
      </div>
    </div>
  );
}
