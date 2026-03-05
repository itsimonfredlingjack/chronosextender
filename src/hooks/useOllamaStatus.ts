import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/tauri";
import type { OllamaStatus } from "../lib/types";

export function useOllamaStatus() {
  const [status, setStatus] = useState<OllamaStatus>({
    connected: false,
    available_models: [],
  });

  useEffect(() => {
    api.getOllamaStatus().then(setStatus).catch(console.error);

    const unlisten = listen<OllamaStatus>("ollama-status-changed", (event) => {
      setStatus(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return status;
}
