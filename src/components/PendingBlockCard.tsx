import { useState } from "react";
import type { Event, Category } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";

const allCategories: Category[] = [
  "coding", "communication", "design", "documentation",
  "browsing", "meeting", "admin", "entertainment", "unknown",
];

interface Props {
  events: Event[];
  appName: string;
  onClassify: (eventIds: number[], category: string, project: string | null) => void;
  onCreateRule: (appName: string, category: string) => void;
}

export default function PendingBlockCard({
  events,
  appName,
  onClassify,
  onCreateRule,
}: Props) {
  const [selected, setSelected] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const totalSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);
  const mins = Math.round(totalSeconds / 60);
  const startTime = new Date(events[0].start_time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const ids = events.map((e) => e.id);
      await onClassify(ids, selected, null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#fcfaf5] rounded-lg p-4 border border-[#d7d0c3] card-elevated">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{appName}</p>
          <p className="text-xs text-slate-600">
            {startTime} · {mins}m · {events.length} event{events.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {allCategories.map((cat) => {
          const color = CATEGORY_COLORS[cat];
          const isSelected = selected === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelected(cat)}
              title={CATEGORY_LABELS[cat]}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                isSelected
                  ? "ring-2 ring-offset-1 ring-indigo-500 ring-offset-[#fcfaf5] scale-110"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{ backgroundColor: color, color: "#fff" }}
            >
              {CATEGORY_LABELS[cat].charAt(0)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          className="flex-1 btn-primary text-xs focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#fcfaf5]"
        >
          {saving ? "Saving..." : selected ? `Confirm as ${CATEGORY_LABELS[selected]}` : "Pick a category"}
        </button>
        {selected && (
          <button
            onClick={() => onCreateRule(appName, selected)}
            className="text-xs text-indigo-600 hover:underline shrink-0"
          >
            + Rule
          </button>
        )}
      </div>
    </div>
  );
}
