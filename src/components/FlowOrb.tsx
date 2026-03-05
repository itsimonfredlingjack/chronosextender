import type { FlowStatus } from "../lib/types";

interface FlowOrbProps {
  flowStatus: FlowStatus;
}

export default function FlowOrb({ flowStatus }: FlowOrbProps) {
  const { in_flow, current_app, duration_minutes } = flowStatus;

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all ${
            in_flow
              ? "bg-indigo-500 shadow-lg shadow-indigo-500/50 animate-pulse"
              : current_app
              ? "bg-green-500"
              : "bg-gray-400"
          }`}
        >
          {duration_minutes > 0 ? `${duration_minutes}m` : "--"}
        </div>
        {in_flow && (
          <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-30" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {in_flow ? "In Flow" : current_app ? "Tracking" : "Idle"}
        </p>
        {current_app && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-40">
            {current_app}
          </p>
        )}
      </div>
    </div>
  );
}
