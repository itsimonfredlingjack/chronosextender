import type { AssistantMessage } from "../../types/ai-types";

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderRichText(content: string, isUser: boolean) {
  const parts = content.split(/(\b\d+(?:\.\d+)?(?:h|m|%|x)?\b)/g);
  return parts.map((part, index) =>
    /^\d/.test(part) ? (
      <span
        key={`${part}-${index}`}
        className={`font-mono text-[0.95em] ${isUser ? "text-slate-50" : "text-indigo-950"}`}
      >
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export function ChatMessage({
  message,
  streaming,
}: {
  message: AssistantMessage;
  streaming: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-[0_16px_34px_rgba(30,41,59,0.18)] ${
          isUser
            ? "border-indigo-500/35 bg-gradient-to-br from-indigo-500/92 to-blue-500/78 text-slate-50"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-slate-800 backdrop-blur-xl"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-6">
          {message.content ? (
            renderRichText(message.content, isUser)
          ) : streaming ? (
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
            </div>
          ) : null}
        </div>
        <div className={`mt-2 text-[11px] ${isUser ? "text-indigo-100/90" : "text-slate-500"}`}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
