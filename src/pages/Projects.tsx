import { useState, useEffect } from "react";
import { api } from "../lib/tauri";
import type { Project, NewProject } from "../lib/types";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewProject>({
    name: "",
    client: null,
    hourly_rate: null,
    color: "#6366f1",
    is_billable: true,
  });

  const loadProjects = () => {
    api.getProjects().then(setProjects).catch(console.error);
  };

  useEffect(loadProjects, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.upsertProject(form);
      setForm({
        name: "",
        client: null,
        hourly_rate: null,
        color: "#6366f1",
        is_billable: true,
      });
      setShowForm(false);
      loadProjects();
    } catch (e) {
      console.error("Failed to save project:", e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Projects
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New Project"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Project name"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Client
              </label>
              <input
                value={form.client || ""}
                onChange={(e) =>
                  setForm({ ...form, client: e.target.value || null })
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Client name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Hourly Rate
              </label>
              <input
                type="number"
                value={form.hourly_rate || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hourly_rate: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="SEK/hour"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Color
              </label>
              <input
                type="color"
                value={form.color || "#6366f1"}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-9 rounded-lg cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_billable}
              onChange={(e) =>
                setForm({ ...form, is_billable: e.target.checked })
              }
              className="rounded"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Billable
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Project
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {project.name}
              </h3>
            </div>
            {project.client && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                {project.client}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 ml-7 text-xs text-gray-400">
              {project.hourly_rate && (
                <span>{project.hourly_rate} SEK/h</span>
              )}
              <span>{project.is_billable ? "Billable" : "Non-billable"}</span>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-gray-400 col-span-full">
            No projects yet. Create one to start categorizing your time.
          </p>
        )}
      </div>
    </div>
  );
}
