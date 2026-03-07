export function ChatHeader({
  currentView,
  modelLabel,
  statusLabel,
  onOpenSettings,
  onClear,
  onClose,
}: {
  currentView: string;
  modelLabel: string;
  statusLabel: string;
  onOpenSettings: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-white/10 bg-[#0b0b17]/90 px-4 py-4 backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-indigo-300/80">Chronos AI</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Embedded Assistant</h2>
          <p className="mt-1 text-xs text-gray-400">
            Using {currentView} context with {modelLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:border-white/20 hover:text-white"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:border-white/20 hover:text-white"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-gray-300">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        {statusLabel}
      </div>
    </div>
  );
}
