import { useState, useEffect } from "react";
import PageTopStrip from "../components/PageTopStrip";
import { useCommandDeckState } from "../hooks/useCommandDeckState";
import { api } from "../lib/tauri";
import { useOllamaStatus } from "../hooks/useOllamaStatus";
import type {
  AssistantSecretStatus,
  Settings as SettingsType,
  Rule,
  Project,
  NewProject,
  CloudSyncStatus as CloudSyncStatusType,
} from "../lib/types";
import { ASSISTANT_MODEL_OPTIONS } from "../config/ai-config";
import type { AIProvider } from "../types/ai-types";

export default function Settings() {
  const { visualState, statusLabel } = useCommandDeckState();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [savingAssistantKey, setSavingAssistantKey] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatusType | null>(null);
  const [assistantSecretStatus, setAssistantSecretStatus] = useState<AssistantSecretStatus | null>(null);
  const [assistantApiKey, setAssistantApiKey] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    api.getCloudSyncStatus().then(setCloudStatus).catch(console.error);
    loadProjects();
  }, []);

  useEffect(() => {
    if (!settings) return;

    if (settings.assistant.provider === "local") {
      setAssistantSecretStatus({ provider: "local", configured: true });
      return;
    }

    api
      .getAssistantSecretStatus(settings.assistant.provider)
      .then(setAssistantSecretStatus)
      .catch(console.error);
  }, [settings?.assistant.provider]);

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
      const nextStatus = await api.getCloudSyncStatus();
      setCloudStatus(nextStatus);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleCloudSync = async () => {
    setSyncingCloud(true);
    try {
      await api.syncCloudNow();
      const nextStatus = await api.getCloudSyncStatus();
      setCloudStatus(nextStatus);
      setSettings((prev) =>
        prev
          ? {
            ...prev,
            cloud: {
              ...prev.cloud,
              last_sync_at: nextStatus.last_sync_at,
            },
          }
          : prev
      );
    } catch (e) {
      console.error("Cloud sync failed:", e);
    } finally {
      setSyncingCloud(false);
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

  const handleSaveAssistantKey = async () => {
    if (!settings || settings.assistant.provider === "local" || !assistantApiKey.trim()) {
      return;
    }

    setSavingAssistantKey(true);
    try {
      await api.setAssistantApiKey(settings.assistant.provider, assistantApiKey.trim());
      const nextStatus = await api.getAssistantSecretStatus(settings.assistant.provider);
      setAssistantSecretStatus(nextStatus);
      setAssistantApiKey("");
    } catch (error) {
      console.error("Failed to save assistant API key:", error);
    } finally {
      setSavingAssistantKey(false);
    }
  };

  const handleClearAssistantKey = async () => {
    if (!settings || settings.assistant.provider === "local") {
      return;
    }

    setSavingAssistantKey(true);
    try {
      await api.clearAssistantApiKey(settings.assistant.provider);
      const nextStatus = await api.getAssistantSecretStatus(settings.assistant.provider);
      setAssistantSecretStatus(nextStatus);
      setAssistantApiKey("");
    } catch (error) {
      console.error("Failed to clear assistant API key:", error);
    } finally {
      setSavingAssistantKey(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl animate-pulse">
        <div className="h-7 w-24 bg-[var(--color-card)] rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[var(--color-card)] rounded-lg p-5 border border-[var(--color-border)] space-y-3">
            <div className="h-4 w-28 bg-[var(--color-elevated)] rounded" />
            <div className="h-8 w-full bg-[var(--color-elevated)] rounded" />
            <div className="h-8 w-3/4 bg-[var(--color-elevated)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl overflow-auto h-full">
      <PageTopStrip
        title="Settings"
        subtitle="Configure tracking, AI, and sync behavior"
        visualState={visualState}
        statusLabel={statusLabel}
      />

      {/* Projects — always visible */}
      <Section title="Projects">
        <div className="space-y-2 mb-3">
          {projects.map((project) => (
            <div key={project.id} className="flex flex-wrap items-center gap-2 sm:gap-3 py-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-sm text-slate-800 flex-1">{project.name}</span>
              {project.client && (
                <span className="text-xs text-slate-600">{project.client}</span>
              )}
              <span className="text-xs text-slate-600">
                {project.is_billable ? "Billable" : "Non-billable"}
              </span>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-slate-600">No projects yet.</p>
          )}
        </div>
        {showProjectForm ? (
          <form onSubmit={handleSaveProject} className="space-y-2 border-t border-[var(--color-border)] pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                className="input-field"
                placeholder="Project name"
                required
              />
              <input
                value={projectForm.client || ""}
                onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value || null })}
                className="input-field"
                placeholder="Client"
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="btn-primary text-xs">Save</button>
              <button type="button" onClick={() => setShowProjectForm(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowProjectForm(true)}
            className="text-xs text-indigo-600 hover:text-indigo-500"
          >
            + Add Project
          </button>
        )}
      </Section>

      {/* Classification Rules — always visible */}
      <Section title="Classification Rules">
        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-sm text-slate-600">
              No rules yet. Create rules from the Review Queue.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 py-2 border-b border-[var(--color-border)] last:border-0"
              >
                <span className="text-xs text-slate-600 w-8">#{rule.priority}</span>
                <span className="text-xs px-2 py-0.5 bg-[var(--color-surface)] rounded text-slate-700">
                  {rule.match_type}
                </span>
                <span className="text-sm text-slate-800 flex-1 truncate">
                  {rule.match_value}
                </span>
                <span className="text-xs text-indigo-600">{rule.target_category}</span>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* Advanced accordion */}
      <div>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between py-3 text-sm text-slate-500 hover:text-slate-700 transition-colors border-t border-[var(--color-border)]"
        >
          <span className="font-medium">Advanced</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="transition-transform duration-200"
            style={{ transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="space-y-6 pt-2">
            {/* AI Status */}
            <Section title="AI Status">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`w-3 h-3 rounded-full ${ollamaStatus.connected ? "bg-green-500" : "bg-red-500"
                    }`}
                />
                <span className="text-sm text-slate-700">
                  Ollama {ollamaStatus.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              {ollamaStatus.available_models.length > 0 && (
                <p className="text-xs text-slate-500 mb-3">
                  Models: {ollamaStatus.available_models.join(", ")}
                </p>
              )}
              <label className="block text-xs text-slate-600 mb-1">Ollama URL</label>
              <input
                value={settings.ai.ollama_url}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai: { ...settings.ai, ollama_url: e.target.value },
                  })
                }
                className="input-field w-full"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
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
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
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
                    className="input-field w-full"
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
                  className="rounded accent-indigo-500"
                />
                <label className="text-sm text-slate-700">Enable tracking</label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
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
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
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
                    className="input-field w-full"
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
                  className="rounded accent-indigo-500"
                />
                <label className="text-sm text-slate-700">Enable Flow Guard</label>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
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
                  className="input-field w-full max-w-40"
                />
              </div>
              <div className="mt-3">
                <label className="block text-xs text-slate-600 mb-1">
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
                  className="input-field w-full font-mono"
                />
              </div>
            </Section>

            <Section title="Cloud Sync">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={settings.cloud.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cloud: { ...settings.cloud, enabled: e.target.checked },
                    })
                  }
                  className="rounded accent-indigo-500"
                />
                <label className="text-sm text-slate-700">Enable hosted ChatGPT sync</label>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Hosted Base URL</label>
                  <input
                    value={settings.cloud.base_url}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cloud: { ...settings.cloud, base_url: e.target.value },
                      })
                    }
                    className="input-field w-full"
                    placeholder="https://chronos-mcp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Owner Sync Token</label>
                  <input
                    type="password"
                    value={settings.cloud.sync_token}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cloud: { ...settings.cloud, sync_token: e.target.value },
                      })
                    }
                    className="input-field w-full"
                    placeholder="Paste the bearer token from the hosted layer"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-3 space-y-1.5">
                <p className="text-xs text-slate-600">
                  Device ID: <span className="text-slate-800">{cloudStatus?.device_id || "chronos-desktop"}</span>
                </p>
                <p className="text-xs text-slate-600">
                  Status:{" "}
                  <span className={cloudStatus?.configured ? "text-emerald-600" : "text-amber-600"}>
                    {cloudStatus?.configured ? "Configured" : "Needs base URL and token"}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Last sync: {settings.cloud.last_sync_at || "Never"}
                </p>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Sync uploads daily summaries, project rollups, and flow sessions only.
                </p>
                <button
                  onClick={handleCloudSync}
                  disabled={syncingCloud || !settings.cloud.enabled}
                  className="btn-ghost text-xs"
                >
                  {syncingCloud ? "Syncing..." : "Sync Now"}
                </button>
              </div>
            </Section>

            <Section title="Embedded Assistant">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={settings.assistant.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      assistant: { ...settings.assistant, enabled: e.target.checked },
                    })
                  }
                  className="rounded accent-indigo-500"
                />
                <label className="text-sm text-slate-700">Enable in-app assistant</label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Provider</label>
                  <select
                    value={settings.assistant.provider}
                    onChange={(e) => {
                      const nextProvider = e.target.value as AIProvider;
                      setAssistantApiKey("");
                      setSettings({
                        ...settings,
                        assistant: {
                          ...settings.assistant,
                          provider: nextProvider,
                          model: ASSISTANT_MODEL_OPTIONS[nextProvider][0],
                        },
                      });
                    }}
                    className="input-field w-full"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="local">Local HTTP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Model</label>
                  <select
                    value={settings.assistant.model}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        assistant: { ...settings.assistant, model: e.target.value },
                      })
                    }
                    className="input-field w-full"
                  >
                    {ASSISTANT_MODEL_OPTIONS[settings.assistant.provider].map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs text-slate-600">Temperature</label>
                  <span className="text-xs text-slate-700 font-mono">
                    {settings.assistant.temperature.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.assistant.temperature}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      assistant: {
                        ...settings.assistant,
                        temperature: parseFloat(e.target.value) || 0.3,
                      },
                    })
                  }
                  className="mt-2 w-full accent-indigo-500"
                />
              </div>

              <div className="mt-4">
                <label className="block text-xs text-slate-600 mb-1">System Prompt</label>
                <textarea
                  value={settings.assistant.system_prompt}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      assistant: {
                        ...settings.assistant,
                        system_prompt: e.target.value,
                      },
                    })
                  }
                  rows={8}
                  className="input-field w-full font-mono text-xs"
                />
              </div>

              {settings.assistant.provider === "local" && (
                <div className="mt-4">
                  <label className="block text-xs text-slate-600 mb-1">Local Base URL</label>
                  <input
                    value={settings.assistant.local_base_url}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        assistant: {
                          ...settings.assistant,
                          local_base_url: e.target.value,
                        },
                      })
                    }
                    className="input-field w-full"
                    placeholder="http://localhost:8080"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Chronos appends <span className="font-mono">/v1/chat/completions</span> unless you
                    provide a full <span className="font-mono">.../chat/completions</span> endpoint.
                  </p>
                </div>
              )}

              {settings.assistant.provider !== "local" && (
                <div className="mt-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-700">
                        API key is stored securely in your system keychain.
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Current provider: <span className="text-slate-700">{settings.assistant.provider}</span>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] ${assistantSecretStatus?.configured
                          ? "bg-emerald-500/12 text-emerald-700"
                          : "bg-amber-500/12 text-amber-700"
                        }`}
                    >
                      {assistantSecretStatus?.configured ? "Stored" : "Missing"}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">API Key</label>
                    <input
                      type="password"
                      value={assistantApiKey}
                      onChange={(e) => setAssistantApiKey(e.target.value)}
                      className="input-field w-full"
                      placeholder={`Paste your ${settings.assistant.provider} API key`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSaveAssistantKey}
                      disabled={savingAssistantKey || !assistantApiKey.trim()}
                      className="btn-primary text-xs"
                    >
                      {savingAssistantKey ? "Saving..." : "Save Key"}
                    </button>
                    <button
                      onClick={handleClearAssistantKey}
                      disabled={savingAssistantKey || !assistantSecretStatus?.configured}
                      className="btn-ghost text-xs"
                    >
                      Clear Key
                    </button>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-stretch sm:justify-end pt-4 pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full sm:w-auto"
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
    <div className="settings-section animate-slide-up">
      <h3 className="text-sm font-medium text-slate-800 mb-4 pl-2">{title}</h3>
      {children}
    </div>
  );
}
