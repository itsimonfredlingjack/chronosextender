import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/tauri";
import { trimConversationHistory } from "../lib/assistant/chatPayload";
import type {
  AssistantMessage,
  AssistantSettings,
  AssistantStreamEnvelope,
} from "../types/ai-types";

function createMessage(role: AssistantMessage["role"], content: string, id?: string): AssistantMessage {
  return {
    id: id ?? crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function useAIChat(args: {
  contextXml: string;
  settings: AssistantSettings | null;
  hasCredential: boolean;
}) {
  const { contextXml, settings, hasCredential } = args;
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const messagesRef = useRef<AssistantMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const unlisten = listen<AssistantStreamEnvelope>("assistant-stream-event", ({ payload }) => {
      if (!activeRequestIdRef.current || payload.request_id !== activeRequestIdRef.current) {
        return;
      }

      if (payload.event_type === "response.output_text.delta" && payload.delta) {
        setMessages((current) =>
          trimConversationHistory(
            current.map((message) =>
              message.id === activeAssistantIdRef.current
                ? { ...message, content: message.content + payload.delta }
                : message
            )
          )
        );
        return;
      }

      if (payload.event_type === "response.completed") {
        setStreaming(false);
        setError(null);
        activeRequestIdRef.current = null;
        activeAssistantIdRef.current = null;
        return;
      }

      if (payload.event_type === "response.error") {
        const nextError = payload.error ?? "The assistant stream failed.";
        setMessages((current) =>
          trimConversationHistory(
            current.map((message) =>
              message.id === activeAssistantIdRef.current
                ? {
                    ...message,
                    content: message.content || nextError,
                  }
                : message
            )
          )
        );
        setStreaming(false);
        setError(nextError);
        activeRequestIdRef.current = null;
        activeAssistantIdRef.current = null;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (activeRequestIdRef.current) {
        api.cancelAssistantStream(activeRequestIdRef.current).catch(() => {});
      }
    };
  }, []);

  const sendMessage = async (rawMessage: string) => {
    const userMessage = rawMessage.trim();
    if (!userMessage) return;

    if (!settings?.enabled) {
      setMessages((current) =>
        trimConversationHistory([
          ...current,
          createMessage("assistant", "Enable the embedded assistant in Settings before starting a chat."),
        ])
      );
      return;
    }

    if (settings.provider !== "local" && !hasCredential) {
      setMessages((current) =>
        trimConversationHistory([
          ...current,
          createMessage("assistant", `Save a ${settings.provider} API key in Settings before sending a message.`),
        ])
      );
      return;
    }

    const requestId = crypto.randomUUID();
    const userEntry = createMessage("user", userMessage);
    const assistantEntry = createMessage("assistant", "", `assistant-${requestId}`);
    const history = trimConversationHistory(messagesRef.current);

    activeRequestIdRef.current = requestId;
    activeAssistantIdRef.current = assistantEntry.id;
    setStreaming(true);
    setError(null);
    setMessages((current) => trimConversationHistory([...current, userEntry, assistantEntry]));

    try {
      await api.startAssistantStream({
        requestId,
        history,
        contextXml,
        userMessage,
      });
    } catch (streamError) {
      const nextError =
        streamError instanceof Error ? streamError.message : "The assistant could not start.";
      setMessages((current) =>
        trimConversationHistory(
          current.map((message) =>
            message.id === assistantEntry.id ? { ...message, content: nextError } : message
          )
        )
      );
      setStreaming(false);
      setError(nextError);
      activeRequestIdRef.current = null;
      activeAssistantIdRef.current = null;
    }
  };

  const cancelStream = async () => {
    if (!activeRequestIdRef.current) return;
    const requestId = activeRequestIdRef.current;
    activeRequestIdRef.current = null;
    activeAssistantIdRef.current = null;
    setStreaming(false);
    setError(null);
    await api.cancelAssistantStream(requestId).catch((cancelError) => {
      console.error("Failed to cancel assistant stream:", cancelError);
    });
  };

  return {
    messages,
    streaming,
    error,
    sendMessage,
    cancelStream,
    clearConversation: () => setMessages([]),
  };
}
