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
    <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-indigo-600/80">Chronos AI</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Embedded Assistant</h2>
          <p className="mt-1 text-xs text-slate-600">
            Using {currentView} context with {modelLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-slate-700 transition hover:border-[var(--color-border-strong)] hover:text-slate-900"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-slate-700 transition hover:border-[var(--color-border-strong)] hover:text-slate-900"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-slate-700 transition hover:border-[var(--color-border-strong)] hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-[11px] text-slate-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {statusLabel}
      </div>
    </div>
  );
}
