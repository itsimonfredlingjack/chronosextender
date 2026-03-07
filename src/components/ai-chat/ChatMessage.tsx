import type { AssistantMessage } from "../../types/ai-types";

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderRichText(content: string) {
  const parts = content.split(/(\b\d+(?:\.\d+)?(?:h|m|%|x)?\b)/g);
  return parts.map((part, index) =>
    /^\d/.test(part) ? (
      <span key={`${part}-${index}`} className="font-mono text-[0.95em] text-white">
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
        className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.25)] ${
          isUser
            ? "border-indigo-400/40 bg-gradient-to-br from-indigo-500/90 to-indigo-400/70 text-white"
            : "border-white/10 bg-white/[0.06] text-gray-100 backdrop-blur-xl"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-6">
          {message.content ? (
            renderRichText(message.content)
          ) : streaming ? (
            <div className="flex items-center gap-1.5 text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
            </div>
          ) : null}
        </div>
        <div className={`mt-2 text-[11px] ${isUser ? "text-indigo-100/80" : "text-gray-500"}`}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
