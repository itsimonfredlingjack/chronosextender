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
      for (const event of block.events) {
        await api.reclassifyEvent(
          event.id,
          block.project,
          block.dominantCategory,
          null
        );
      }
      onApproved(block.id);
    } catch (e) {
      console.error("Failed to approve block:", e);
    } finally {
      setApproving(false);
    }
  };

  const handleEditCategory = async (newCategory: string) => {
    setApproving(true);
    try {
      for (const event of block.events) {
        await api.reclassifyEvent(event.id, block.project, newCategory, null);
      }
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
      className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a40] border-l-4 card-elevated transition-all"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-base font-semibold text-white">{block.label}</h4>
          <p className="text-xs text-gray-400 mt-0.5">
            {startTime} — {endTime}
          </p>
        </div>
        <span className="text-sm font-bold text-gray-300 tabular-nums">
          {formatDuration(block.duration_seconds)}
        </span>
      </div>

      <p className="text-xs text-gray-400 mb-3">{generateBlockDescription(block)}</p>

      <CategoryMiniBar categories={categoryBreakdown} />

      <div className="flex flex-wrap gap-1 mt-3">
        {block.apps.map((app) => (
          <span
            key={app}
            className="text-xs px-1.5 py-0.5 rounded bg-[#12121e] text-gray-400"
          >
            {app}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2a2a40]/50">
        <button
          onClick={handleApprove}
          disabled={approving}
          className="flex-1 btn-primary text-xs focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1a2e]"
        >
          {approving ? "Saving..." : "Approve"}
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
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white transition-all hover:scale-110 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1a2e]"
                  style={{ backgroundColor: catColor }}
                >
                  {CATEGORY_LABELS[cat].charAt(0)}
                </button>
              );
            })}
            <button
              onClick={() => setEditing(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs bg-[#22223a] text-gray-400 hover:bg-[#2a2a40] transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="btn-ghost text-xs"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
