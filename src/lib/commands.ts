import { api } from "./tauri";
import type { Category } from "./types";
import { CATEGORY_LABELS } from "./types";

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  keywords: string[];
  execute: () => void | Promise<void>;
}

const categories: Category[] = [
  "coding", "communication", "design", "documentation",
  "browsing", "meeting", "admin", "entertainment",
];

export function createNavActions(
  navigate: (path: string) => void,
  onClose: () => void,
): CommandAction[] {
  return [
    {
      id: "nav-dashboard",
      label: "Go to Pulse",
      icon: "\u25C9",
      keywords: ["dashboard", "home", "main", "pulse"],
      execute: () => { navigate("/"); onClose(); },
    },
    {
      id: "nav-review",
      label: "Go to Review",
      icon: "\u2630",
      keywords: ["review", "blocks", "check", "look"],
      execute: () => { navigate("/review"); onClose(); },
    },
    {
      id: "nav-timesheets",
      label: "Go to Timesheets",
      icon: "\u25A4",
      keywords: ["timesheets", "reports", "summary", "analytics", "export", "time"],
      execute: () => { navigate("/timesheets"); onClose(); },
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      icon: "\u2699",
      keywords: ["settings", "config", "preferences"],
      execute: () => { navigate("/settings"); onClose(); },
    },
  ];
}

export function createToggleActions(onClose: () => void): CommandAction[] {
  return [
    {
      id: "toggle-tracking",
      label: "Toggle Tracking",
      description: "Pause or resume time tracking",
      icon: "\u23EF",
      keywords: ["tracking", "pause", "resume", "toggle", "stop", "start"],
      execute: async () => { await api.toggleTracking(); onClose(); },
    },
    {
      id: "ai-reclassify",
      label: "AI Review Pass",
      description: "Ask AI to take another pass on items that still need review",
      icon: "\u2728",
      keywords: ["ai", "review", "batch", "unclear", "tier2", "ollama"],
      execute: async () => { await api.triggerBatchReclassify(); onClose(); },
    },
  ];
}

export function createClassifyActions(onClose: () => void): CommandAction[] {
  return categories.map((cat) => ({
    id: `classify-all-${cat}`,
    label: `Mark review items as ${CATEGORY_LABELS[cat]}`,
    description: "Apply one category to everything that still needs review",
    icon: "\u229E",
    keywords: ["classify", "review", "all", cat, CATEGORY_LABELS[cat].toLowerCase()],
    execute: async () => {
      const pending = await api.getPendingEvents();
      for (const e of pending) {
        await api.reclassifyEvent(e.id, null, cat, null);
      }
      onClose();
    },
  }));
}

export function filterCommands(actions: CommandAction[], query: string, limit = 8): CommandAction[] {
  if (!query.trim()) return actions.slice(0, limit);
  const q = query.toLowerCase();
  return actions.filter(
    (a) =>
      a.label.toLowerCase().includes(q) ||
      a.keywords.some((k) => k.includes(q))
  );
}
