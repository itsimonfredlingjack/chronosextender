import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/tauri";
import { useAppContext } from "../../hooks/useAppContext";
import { useAIChat } from "../../hooks/useAIChat";
import { ASSISTANT_MODEL_OPTIONS } from "../../config/ai-config";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { getPresetPrompts } from "./presetPrompts";
import type { AssistantSecretStatus, AssistantSettings, AIProvider } from "../../types/ai-types";

function getStatusLabel(
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

export function AIChatPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [secretStatus, setSecretStatus] = useState<AssistantSecretStatus | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const { currentView, contextXml, loading: contextLoading } = useAppContext();

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const appSettings = await api.getSettings();
        if (!mounted) return;
        setSettings(appSettings.assistant);

        const nextSecretStatus =
          appSettings.assistant.provider === "local"
            ? ({ provider: "local", configured: true } satisfies {
                provider: AIProvider;
                configured: boolean;
              })
            : await api.getAssistantSecretStatus(appSettings.assistant.provider);

        if (mounted) {
          setSecretStatus(nextSecretStatus);
          setLoadingSettings(false);
        }
      } catch (error) {
        console.error("Failed to load assistant settings:", error);
        if (mounted) {
          setLoadingSettings(false);
        }
      }
    };

    loadSettings();
    const unlistenSettings = listen("settings-updated", loadSettings);
    const unlistenSecrets = listen("assistant-secret-status-changed", loadSettings);

    return () => {
      mounted = false;
      unlistenSettings.then((fn) => fn());
      unlistenSecrets.then((fn) => fn());
    };
  }, []);

  const chat = useAIChat({
    contextXml,
    settings,
    hasCredential: secretStatus?.configured ?? false,
  });

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.messages, chat.streaming]);

  const disabled = useMemo(() => {
    if (!settings?.enabled) return true;
    if (settings.provider === "local") return false;
    return !secretStatus?.configured;
  }, [secretStatus?.configured, settings]);

  const modelLabel = useMemo(() => {
    if (!settings) return "no model";
    const options = ASSISTANT_MODEL_OPTIONS[settings.provider];
    return options.includes(settings.model) ? settings.model : `${settings.provider} model`;
  }, [settings]);

  const presetPrompts = useMemo(() => getPresetPrompts(currentView), [currentView]);

  const panel = (
    <div
      className={`pointer-events-none fixed inset-0 z-50 transition duration-300 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`absolute inset-0 bg-[#030309]/55 backdrop-blur-[2px] transition duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-full flex-col border-l border-white/10 bg-[linear-gradient(180deg,rgba(14,14,30,0.95),rgba(7,7,18,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-3xl transition duration-300 sm:w-[380px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <ChatHeader
          currentView={currentView}
          modelLabel={modelLabel}
          statusLabel={getStatusLabel(settings, secretStatus)}
          onOpenSettings={() => {
            navigate("/settings");
            onClose();
          }}
          onClear={chat.clearConversation}
          onClose={onClose}
        />

        <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-gray-400">
            {contextLoading
              ? "Refreshing local app context..."
              : `Context refreshes from local data on ${currentView} and live app events.`}
          </p>
          {chat.error && <p className="mt-2 text-xs text-red-300">{chat.error}</p>}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loadingSettings ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-gray-300">
              Loading assistant settings...
            </div>
          ) : chat.messages.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-sm text-gray-300">
              <p className="leading-6">
                Ask things like "What did I work on today?" or "Which project took most time this
                week?" and I will answer from your local Chronos context.
              </p>
            </div>
          ) : (
            chat.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                streaming={chat.streaming && message.id.startsWith("assistant-") && !message.content}
              />
            ))
          )}
        </div>

        <ChatInput
          disabled={disabled || contextLoading}
          streaming={chat.streaming}
          presetPrompts={presetPrompts}
          onSend={chat.sendMessage}
          onCancel={chat.cancelStream}
        />
      </aside>
    </div>
  );

  return createPortal(panel, document.body);
}
