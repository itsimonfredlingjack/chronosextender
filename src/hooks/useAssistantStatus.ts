import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import { api } from "../lib/tauri";
import type {
  AIProvider,
  AssistantSecretStatus,
  AssistantSettings,
} from "../types/ai-types";

function localSecretStatus(): { provider: AIProvider; configured: boolean } {
  return { provider: "local", configured: true };
}

export function getAssistantStatusLabel(
  settings: AssistantSettings | null,
  secretStatus: AssistantSecretStatus | null
): string {
  if (!settings?.enabled) {
    return "Disabled in Settings";
  }
  if (settings.provider !== "local" && !secretStatus?.configured) {
    return `Waiting for a ${settings.provider} API key`;
  }
  if (settings.provider === "local") {
    return "Connected to local HTTP provider";
  }
  return `${settings.provider} key stored securely`;
}

export function getAssistantPopoverValue(
  settings: AssistantSettings | null,
  secretStatus: AssistantSecretStatus | null,
  loading: boolean
): string {
  if (loading || !settings) {
    return "Loading";
  }
  if (!settings.enabled) {
    return "Disabled";
  }
  if (settings.provider === "local") {
    return settings.model;
  }
  if (!secretStatus?.configured) {
    return "Needs key";
  }
  return `${settings.provider} · ${settings.model}`;
}

export function getAssistantPopoverDotClassName(
  settings: AssistantSettings | null,
  secretStatus: AssistantSecretStatus | null,
  loading: boolean
): string {
  if (loading || !settings) {
    return "bg-slate-400";
  }
  if (!settings.enabled) {
    return "bg-slate-400";
  }
  if (settings.provider !== "local" && !secretStatus?.configured) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
}

export function useAssistantStatus() {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [secretStatus, setSecretStatus] = useState<AssistantSecretStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const appSettings = await api.getSettings();
        if (!mounted) return;
        setSettings(appSettings.assistant);

        const nextSecretStatus =
          appSettings.assistant.provider === "local"
            ? localSecretStatus()
            : await api.getAssistantSecretStatus(appSettings.assistant.provider);

        if (!mounted) return;
        setSecretStatus(nextSecretStatus);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load assistant settings:", error);
        if (!mounted) return;
        setLoading(false);
      }
    };

    void loadSettings();
    const unlistenSettings = listen("settings-updated", loadSettings);
    const unlistenSecrets = listen("assistant-secret-status-changed", loadSettings);

    return () => {
      mounted = false;
      unlistenSettings.then((fn) => fn());
      unlistenSecrets.then((fn) => fn());
    };
  }, []);

  return {
    settings,
    secretStatus,
    loading,
  };
}
