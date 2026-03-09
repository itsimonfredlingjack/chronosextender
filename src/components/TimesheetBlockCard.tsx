import { useState } from "react";
import type { Category, TimesheetStatus, WorkBlock } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import { formatDuration } from "../lib/sessions";
import { generateBlockDescription } from "../lib/workblocks";
import CategoryMiniBar from "./CategoryMiniBar";

const categories: Category[] = [
  "coding",
  "communication",
  "design",
  "documentation",
  "browsing",
  "meeting",
  "admin",
  "entertainment",
  "unknown",
];

const STATUS_META: Record<TimesheetStatus, { label: string; className: string }> = {
  suggested: {
    label: "Suggested",
    className: "bg-sky-500/10 text-sky-700 border border-sky-500/20",
  },
  needs_review: {
    label: "Needs Review",
    className: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
  },
  excluded: {
    label: "Excluded",
    className: "bg-slate-500/10 text-slate-600 border border-slate-400/20",
  },
};

interface Props {
  block: WorkBlock;
  status: TimesheetStatus;
  onApprove: (args: {
    eventIds: number[];
    project: string | null;
    category: string;
    taskDescription: string | null;
  }) => Promise<void>;
  onExclude: (eventIds: number[]) => Promise<void>;
}

export default function TimesheetBlockCard({ block, status, onApprove, onExclude }: Props) {
  const [project, setProject] = useState(block.project ?? "");
  const [category, setCategory] = useState<string>(block.dominantCategory);
  const [taskDescription, setTaskDescription] = useState(
    block.events.find((event) => event.task_description)?.task_description ?? ""
  );
  const [saving, setSaving] = useState(false);

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
      .filter((session) => session.category === cat)
      .reduce((sum, session) => sum + session.duration_seconds, 0),
  }));

  const accent = CATEGORY_COLORS[block.dominantCategory] || CATEGORY_COLORS.unknown;

  const handleApprove = async () => {
    setSaving(true);
    try {
      await onApprove({
        eventIds: block.events.map((event) => event.id),
        project: project.trim() || null,
        category,
        taskDescription: taskDescription.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExclude = async () => {
    setSaving(true);
    try {
      await onExclude(block.events.map((event) => event.id));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="bg-[var(--color-card)] rounded-2xl p-5 border border-[var(--color-border)] border-l-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-semibold text-slate-900">{block.label}</h4>
            <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${STATUS_META[status].className}`}>
              {STATUS_META[status].label}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {startTime} - {endTime} · {formatDuration(block.duration_seconds)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-700">{block.events.length} events</p>
          <p className="text-[11px] text-slate-500">{block.apps.slice(0, 3).join(", ")}</p>
        </div>
      </div>

      <p className="text-xs text-slate-600 mt-3">{generateBlockDescription(block)}</p>

      <div className="mt-3">
        <CategoryMiniBar categories={categoryBreakdown} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Project</span>
          <input
            value={project}
            onChange={(event) => setProject(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            placeholder="Project name"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 md:col-span-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Task</span>
          <input
            value={taskDescription}
            onChange={(event) => setTaskDescription(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
            placeholder="What was this block for?"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
        <button
          onClick={handleApprove}
          disabled={saving}
          className="btn-primary text-xs"
        >
          {saving ? "Saving..." : status === "approved" ? "Save Approved" : "Approve Block"}
        </button>
        <button
          onClick={handleExclude}
          disabled={saving}
          className="btn-ghost text-xs"
        >
          Exclude
        </button>
        <p className="text-[11px] text-slate-500 ml-auto">
          Approved blocks can be exported. Excluded blocks stay out of the final timesheet.
        </p>
      </div>
    </div>
  );
}
