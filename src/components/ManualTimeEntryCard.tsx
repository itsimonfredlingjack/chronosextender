import { useMemo, useState } from "react";
import type {
  Category,
  ManualTimeEntry,
  NewManualTimeEntry,
  TimesheetStatus,
} from "../lib/types";
import { CATEGORY_LABELS } from "../lib/types";

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

const STATUS_META: Record<TimesheetStatus, string> = {
  suggested: "bg-sky-500/10 text-sky-700 border border-sky-500/20",
  needs_review: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
  excluded: "bg-slate-500/10 text-slate-600 border border-slate-400/20",
};

interface Props {
  entry: ManualTimeEntry;
  onSave: (id: number, entry: NewManualTimeEntry) => Promise<void>;
  onApprove: (id: number) => Promise<void>;
  onExclude: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function ManualTimeEntryCard({
  entry,
  onSave,
  onApprove,
  onExclude,
  onDelete,
}: Props) {
  const [entryDate, setEntryDate] = useState(entry.entry_date);
  const [durationMinutes, setDurationMinutes] = useState(
    Math.max(1, Math.round(entry.duration_seconds / 60))
  );
  const [project, setProject] = useState(entry.project ?? "");
  const [category, setCategory] = useState<Category>(
    (entry.category as Category | null) ?? "unknown"
  );
  const [taskDescription, setTaskDescription] = useState(entry.task_description ?? "");
  const [saving, setSaving] = useState(false);

  const draft = useMemo<NewManualTimeEntry>(
    () => ({
      entry_date: entryDate,
      duration_seconds: Math.max(1, durationMinutes) * 60,
      project: project.trim() || null,
      category,
      task_description: taskDescription.trim() || null,
      source: entry.source,
    }),
    [category, durationMinutes, entry.source, entryDate, project, taskDescription]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(entry.id, draft);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await onSave(entry.id, draft);
      await onApprove(entry.id);
    } finally {
      setSaving(false);
    }
  };

  const handleExclude = async () => {
    setSaving(true);
    try {
      await onExclude(entry.id);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete(entry.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--color-card)] rounded-2xl p-4 border border-[var(--color-border)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Manual time entry</h4>
          <p className="text-[11px] text-slate-500">
            Added via {entry.source === "manual_nlp" ? "AI logging" : "manual entry"}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${STATUS_META[entry.timesheet_status]}`}>
          {entry.timesheet_status.replace("_", " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Date</span>
          <input
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Minutes</span>
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Project</span>
          <input
            value={project}
            onChange={(event) => setProject(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            placeholder="Project name"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-1 mt-3 block">
        <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Task</span>
        <input
          value={taskDescription}
          onChange={(event) => setTaskDescription(event.target.value)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          placeholder="What work should leaders see here?"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[var(--color-border)]">
        <button onClick={handleSave} disabled={saving} className="btn-ghost text-xs">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={handleApprove} disabled={saving} className="btn-primary text-xs">
          Approve
        </button>
        <button onClick={handleExclude} disabled={saving} className="btn-ghost text-xs">
          Exclude
        </button>
        <button onClick={handleDelete} disabled={saving} className="btn-ghost text-xs text-rose-600">
          Delete
        </button>
      </div>
    </div>
  );
}
