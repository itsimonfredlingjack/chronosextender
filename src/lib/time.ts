import { useState, useEffect } from "react";

export function useLiveTimer(startTime: string | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) { setElapsed(0); return; }
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return elapsed;
}

export function formatLiveDuration(seconds: number): { main: string; secs: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return { main: `${h}h ${pad(m)}m`, secs: pad(s) };
  return { main: `${m}m`, secs: pad(s) };
}
