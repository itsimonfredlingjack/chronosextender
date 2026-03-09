import { useState } from "react";
import type { WorkBlock, Category } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import { formatDuration } from "../lib/sessions";
import { generateBlockDescription } from "../lib/workblocks";
import { api } from "../lib/tauri";
import CategoryMiniBar from "./CategoryMiniBar";

const categories: Category[] = [
  "coding", "communication", "design", "documentation",
  "browsing", "meeting", "admin", "entertainment", "unknown",
];

interface Props {
  block: WorkBlock;
  onApproved: (blockId: string) => void;
}

export default function WorkBlockCard({ block, onApproved }: Props) {
  const [approving, setApproving] = useState(false);
  const [editing, setEditing] = useState(false);
  const color = CATEGORY_COLORS[block.dominantCategory] || CATEGORY_COLORS.unknown;

  const startTime = new Date(block.start_time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(block.end_time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const categoryBreakdown = block.categories.map((cat) => ({
    category: cat,
    seconds: block.sessions
      .filter((s) => s.category === cat)
      .reduce((sum, s) => sum + s.duration_seconds, 0),
  }));

  const handleApprove = async () => {
    setApproving(true);
    try {
      await Promise.all(
        block.events.map((event) =>
          api.reclassifyEvent(event.id, block.project, block.dominantCategory, null)
        )
      );
      onApproved(block.id);
    } catch (e) {
      console.error("Failed to confirm block:", e);
    } finally {
      setApproving(false);
    }
  };

  const handleEditCategory = async (newCategory: string) => {
    setApproving(true);
    try {
      await Promise.all(
        block.events.map((event) =>
          api.reclassifyEvent(event.id, block.project, newCategory, null)
        )
      );
      onApproved(block.id);
    } catch (e) {
      console.error("Failed to reclassify block:", e);
    } finally {
      setApproving(false);
      setEditing(false);
    }
  };

  return (
    <div
      className="bg-[var(--color-card)] rounded-xl p-5 border border-[var(--color-border)] border-l-4 card-elevated transition-all hover:-translate-y-0.5"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{block.label}</h4>
          <p className="text-xs text-slate-600 mt-0.5">
            {startTime} — {endTime}
          </p>
        </div>
        <span className="text-sm font-bold text-slate-700 tabular-nums">
          {formatDuration(block.duration_seconds)}
        </span>
      </div>

      <p className="text-xs text-slate-600 mb-3">{generateBlockDescription(block)}</p>

      <CategoryMiniBar categories={categoryBreakdown} />

      <div className="flex flex-wrap gap-1 mt-3">
        {block.apps.map((app) => (
          <span
            key={app}
            className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-slate-600"
          >
            {app}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="flex-1 btn-primary text-xs focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-card)]"
        >
          {approving ? "Saving..." : "Looks right"}
        </button>

        {editing ? (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const catColor = CATEGORY_COLORS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => handleEditCategory(cat)}
                  title={CATEGORY_LABELS[cat]}
                  className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-card)]"
                  style={{
                    backgroundColor: catColor,
                    color: cat === "unknown" ? "#334155" : "#f8fafc",
                  }}
                >
                  {CATEGORY_LABELS[cat].charAt(0)}
                  <span className="text-[10px] opacity-80">{CATEGORY_LABELS[cat]}</span>
                </button>
              );
            })}
            <button
              onClick={() => setEditing(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs bg-[var(--color-elevated)] text-slate-500 hover:bg-[var(--color-border)] transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="btn-ghost text-xs"
          >
            Adjust
          </button>
        )}
      </div>

      {!editing && (
        <p className="mt-2 text-[11px] text-slate-500">
          Looks right approves this block as shown. Adjust lets you change the category first.
        </p>
      )}
    </div>
  );
}
