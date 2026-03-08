interface Props {
  totalSeconds: number;
  goalHours?: number;
  pendingCount: number;
}

export default function OverlayProgressBar({ totalSeconds, goalHours = 8, pendingCount }: Props) {
  const totalHours = totalSeconds / 3600;
  const percent = Math.min(100, (totalHours / goalHours) * 100);
  const h = Math.floor(totalHours);
  const m = Math.floor((totalHours % 1) * 60);

  return (
    <div className="px-5 pb-3">
      <div className="relative h-1.5 bg-[var(--color-elevated)] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
          style={{ width: `${percent}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] rounded-full" />
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
        <div />
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="text-amber-600 font-medium">
              {pendingCount} pending
            </span>
          )}
          <span className="tabular-nums">
            {h > 0 ? `${h}h ${m}m` : `${m}m`} / {goalHours}h
          </span>
        </div>
      </div>
    </div>
  );
}
