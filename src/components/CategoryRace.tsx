import type { Category } from "../lib/types";
import { CATEGORY_COLORS } from "../lib/types";
import { formatDuration } from "../lib/sessions";

interface CategoryRaceProps {
  categories: { category: Category; label: string; seconds: number }[];
  activeCategory?: Category | null;
  totalSeconds: number;
}

export default function CategoryRace({
  categories,
  activeCategory,
}: CategoryRaceProps) {
  const visible = categories.slice(0, 5);
  const maxSeconds = visible[0]?.seconds || 1;

  if (visible.length === 0) return null;

  return (
    <div className="w-full max-w-sm space-y-2.5">
      {visible.map((ct) => {
        const color = CATEGORY_COLORS[ct.category] || CATEGORY_COLORS.unknown;
        const pct = (ct.seconds / maxSeconds) * 100;
        const isActive = ct.category === activeCategory;

        return (
          <div key={ct.category} className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-28 justify-end">
              <span className="text-xs text-gray-500 truncate" title={ct.label}>
                {ct.label}
              </span>
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "ring-2 ring-offset-1 ring-offset-[#0a0a14]" : ""}`}
                style={{
                  backgroundColor: color,
                  boxShadow: isActive ? `0 0 6px ${color}50` : undefined,
                }}
              />
            </div>
            <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  boxShadow: isActive
                    ? `0 0 8px ${color}40, 0 0 3px ${color}30`
                    : `0 0 4px ${color}20`,
                  opacity: isActive ? 1 : 0.85,
                }}
              />
            </div>
            <span className="text-xs text-gray-600 w-14 tabular-nums text-right">
              {formatDuration(ct.seconds)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
