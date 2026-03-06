interface Props {
  totalSeconds: number;
  goalSeconds?: number;
}

export default function DayProgress({ totalSeconds, goalSeconds = 28800 }: Props) {
  const progress = Math.min(1, totalSeconds / goalSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const goalHours = Math.round(goalSeconds / 3600);

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a40] gradient-border card-elevated flex items-center gap-6">
      <div className="shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="progress-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle
            cx="60" cy="60" r={radius}
            fill="none" strokeWidth="8"
            className="stroke-[#2a2a40]"
          />
          <circle
            cx="60" cy="60" r={radius}
            fill="none" strokeWidth="8"
            stroke="url(#progress-gradient)"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
            className="transition-all duration-1000"
          />
          <text
            x="60" y="55" textAnchor="middle"
            className="fill-white text-lg font-bold"
            fontSize="20" fontWeight="700"
          >
            {hours}h {mins}m
          </text>
          <text
            x="60" y="73" textAnchor="middle"
            className="fill-gray-400"
            fontSize="11"
          >
            of {goalHours}h goal
          </text>
        </svg>
      </div>

      <div className="flex-1">
        <h3 className="text-sm font-medium text-white mb-1">Today's Progress</h3>
        <p className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          {Math.round(progress * 100)}%
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {progress >= 1
            ? "Goal reached!"
            : `${Math.round((goalSeconds - totalSeconds) / 60)} minutes to go`}
        </p>
      </div>
    </div>
  );
}
