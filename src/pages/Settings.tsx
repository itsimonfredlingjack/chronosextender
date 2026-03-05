import { useState, useEffect } from "react";
import { api } from "../lib/tauri";
import { useOllamaStatus } from "../hooks/useOllamaStatus";
import type { Settings as SettingsType, Rule, Project, NewProject } from "../lib/types";

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState<NewProject>({
    name: "",
    client: null,
    hourly_rate: null,
    color: "#6366f1",
    is_billable: true,
  });
  const ollamaStatus = useOllamaStatus();

  const loadProjects = () => {
    api.getProjects().then(setProjects).catch(console.error);
  };

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
    api.getRules().then(setRules).catch(console.error);
    loadProjects();
  }, []);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name.trim()) return;
    try {
      await api.upsertProject(projectForm);
      setProjectForm({ name: "", client: null, hourly_rate: null, color: "#6366f1", is_billable: true });
      setShowProjectForm(false);
      loadProjects();
    } catch (e) {
      console.error("Failed to save project:", e);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.updateSettings(settings);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await api.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to delete rule:", e);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h2>

      {/* AI Status */}
      <Section title="AI Status">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`w-3 h-3 rounded-full ${
              ollamaStatus.connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Ollama {ollamaStatus.connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {ollamaStatus.available_models.length > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            Models: {ollamaStatus.available_models.join(", ")}
          </p>
        )}
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          Ollama URL
        </label>
        <input
          value={settings.ai.ollama_url}
          onChange={(e) =>
            setSettings({
              ...settings,
              ai: { ...settings.ai, ollama_url: e.target.value },
            })
          }
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white"
        />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Tier 1 Model (Always-on)
            </label>
            <input
              value={settings.ai.tier1_model}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, tier1_model: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Tier 2 Model (Batch)
            </label>
            <input
              value={settings.ai.tier2_model}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, tier2_model: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Section>

      {/* Tracking */}
      <Section title="Tracking">
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            checked={settings.tracking.enabled}
            onChange={(e) =>
              setSettings({
                ...settings,
                tracking: { ...settings.tracking, enabled: e.target.checked },
              })
            }
            className="rounded"
          />
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Enable tracking
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Dedup Threshold (seconds)
            </label>
            <input
              type="number"
              value={settings.tracking.dedup_threshold_seconds}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  tracking: {
                    ...settings.tracking,
                    dedup_threshold_seconds: parseInt(e.target.value) || 3,
                  },
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Poll Interval (ms)
            </label>
            <input
              type="number"
              value={settings.tracking.poll_interval_ms}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  tracking: {
                    ...settings.tracking,
                    poll_interval_ms: parseInt(e.target.value) || 1000,
                  },
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Section>

      {/* Flow Guard */}
      <Section title="Flow Guard">
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            checked={settings.flow_guard.enabled}
            onChange={(e) =>
              setSettings({
                ...settings,
                flow_guard: {
                  ...settings.flow_guard,
                  enabled: e.target.checked,
                },
              })
            }
            className="rounded"
          />
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Enable Flow Guard
          </label>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Flow Threshold (minutes)
          </label>
          <input
            type="number"
            value={settings.flow_guard.threshold_minutes}
            onChange={(e) =>
              setSettings({
                ...settings,
                flow_guard: {
                  ...settings.flow_guard,
                  threshold_minutes: parseInt(e.target.value) || 20,
                },
              })
            }
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white max-w-40"
          />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Interrupt Apps (bundle IDs, one per line)
          </label>
          <textarea
            value={settings.flow_guard.interrupt_apps.join("\n")}
            onChange={(e) =>
              setSettings({
                ...settings,
                flow_guard: {
                  ...settings.flow_guard,
                  interrupt_apps: e.target.value
                    .split("\n")
                    .filter((s) => s.trim()),
                },
              })
            }
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white font-mono"
          />
        </div>
      </Section>

      {/* Projects */}
      <Section title="Projects">
        <div className="space-y-2 mb-3">
          {projects.map((project) => (
            <div key={project.id} className="flex items-center gap-3 py-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-sm text-gray-900 dark:text-white flex-1">
                {project.name}
              </span>
              {project.client && (
                <span className="text-xs text-gray-400">{project.client}</span>
              )}
              <span className="text-xs text-gray-400">
                {project.is_billable ? "Billable" : "Non-billable"}
              </span>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-gray-400">No projects yet.</p>
          )}
        </div>
        {showProjectForm ? (
          <form onSubmit={handleSaveProject} className="space-y-2 border-t border-gray-100 dark:border-[#2a2a40] pt-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white"
                placeholder="Project name"
                required
              />
              <input
                value={projectForm.client || ""}
                onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value || null })}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-[#2a2a40] rounded-lg bg-white dark:bg-[#12121e] text-gray-900 dark:text-white"
                placeholder="Client"
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Save
              </button>
              <button type="button" onClick={() => setShowProjectForm(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowProjectForm(true)}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            + Add Project
          </button>
        )}
      </Section>

      {/* Rules */}
      <Section title="Classification Rules">
        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-sm text-gray-400">
              No rules yet. Create rules from the Review Queue.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-[#2a2a40] last:border-0"
              >
                <span className="text-xs text-gray-400 w-8">
                  #{rule.priority}
                </span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-[#12121e] rounded text-gray-700 dark:text-gray-300">
                  {rule.match_type}
                </span>
                <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                  {rule.match_value}
                </span>
                <span className="text-xs text-indigo-500">
                  {rule.target_category}
                </span>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* Save button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#1a1a2e] rounded-lg p-5 border border-gray-200 dark:border-[#2a2a40]">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
