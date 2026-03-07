import { useState } from "react";
import type { PresetPrompt } from "./presetPrompts";

export function ChatInput({
  disabled,
  streaming,
  presetPrompts,
  onSend,
  onCancel,
}: {
  disabled: boolean;
  streaming: boolean;
  presetPrompts: PresetPrompt[];
  onSend: (message: string) => Promise<void> | void;
  onCancel: () => Promise<void> | void;
}) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const nextValue = value.trim();
    if (!nextValue || disabled || streaming) {
      return;
    }
    setValue("");
    await onSend(nextValue);
  };

  return (
    <div className="border-t border-white/10 bg-[#050511]/80 px-4 py-4 backdrop-blur-2xl">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
        <div className="mb-3 flex flex-wrap gap-2 px-2 pt-2">
          {presetPrompts.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled || streaming}
              onClick={() => void onSend(preset.prompt)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-gray-300 transition hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={value}
          disabled={disabled || streaming}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={
            disabled
              ? "Enable the assistant and save a provider key in Settings."
              : "Ask about your day, week, projects, or flow sessions..."
          }
          className="min-h-[96px] w-full resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-gray-500 disabled:cursor-not-allowed"
        />
        <div className="mt-2 flex items-center justify-between gap-3 px-2 pb-1">
          <p className="text-[11px] text-gray-500">Enter to send, Shift+Enter for a new line</p>
          <div className="flex items-center gap-2">
            {streaming && (
              <button
                type="button"
                onClick={() => void onCancel()}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-red-400/40 hover:text-red-300"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={disabled || streaming || !value.trim()}
              className="rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
