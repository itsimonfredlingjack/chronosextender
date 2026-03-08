import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../hooks/useAppContext";
import {
  getAssistantStatusLabel,
  useAssistantStatus,
} from "../../hooks/useAssistantStatus";
import { useAIChat } from "../../hooks/useAIChat";
import { ASSISTANT_MODEL_OPTIONS } from "../../config/ai-config";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { getPresetPrompts } from "./presetPrompts";

export function AIChatPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { settings, secretStatus, loading: loadingSettings } = useAssistantStatus();
  const { currentView, contextXml, loading: contextLoading } = useAppContext();

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
        className={`absolute inset-0 bg-[rgba(34,24,16,0.3)] backdrop-blur-[2px] transition duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-full flex-col border-l border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(252,248,241,0.97),rgba(244,238,228,0.94))] shadow-[0_30px_80px_rgba(30,41,59,0.2)] backdrop-blur-3xl transition duration-300 sm:w-[380px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <ChatHeader
          currentView={currentView}
          modelLabel={modelLabel}
          statusLabel={getAssistantStatusLabel(settings, secretStatus)}
          onOpenSettings={() => {
            navigate("/settings");
            onClose();
          }}
          onClear={chat.clearConversation}
          onClose={onClose}
        />

        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <p className="text-xs text-slate-600">
            {contextLoading
              ? "Refreshing local app context..."
              : `Context refreshes from local data on ${currentView} and live app events.`}
          </p>
          {chat.error && <p className="mt-2 text-xs text-red-600">{chat.error}</p>}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loadingSettings ? (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-slate-700">
              Loading assistant settings...
            </div>
          ) : chat.messages.length === 0 ? (
            <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-slate-700">
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
