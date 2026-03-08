import { useMemo } from "react";
import type { Event, Category } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import { formatDuration } from "../lib/sessions";

interface Props {
  events: Event[];
}

export default function CategoryTiles({ events }: Props) {
  const tiles = useMemo(() => {
    const map: Record<string, number> = {};
    const total = events.reduce((sum, e) => sum + e.duration_seconds, 0);
    for (const e of events) {
      const cat = e.category || "unknown";
      map[cat] = (map[cat] || 0) + e.duration_seconds;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, seconds]) => ({
        category: cat as Category,
        seconds,
        percentage: total > 0 ? Math.round((seconds / total) * 100) : 0,
      }));
  }, [events]);

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {tiles.map((tile) => {
        const color = CATEGORY_COLORS[tile.category] || CATEGORY_COLORS.unknown;
        return (
          <div
            key={tile.category}
            className="bg-[#fcfaf5] rounded-lg p-4 border border-[#d7d0c3] card-elevated transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}40` }}
              />
              <span className="text-xs text-slate-700">
                {CATEGORY_LABELS[tile.category] || tile.category}
              </span>
            </div>
            <p className="text-lg font-bold text-slate-900">{formatDuration(tile.seconds)}</p>
            <p className="text-xs text-slate-600">{tile.percentage}% of total</p>
          </div>
        );
      })}
    </div>
  );
}
