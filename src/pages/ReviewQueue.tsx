import { useState, useEffect } from "react";
import { api } from "../lib/tauri";
import type { Event, Category } from "../lib/types";
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

export default function ReviewQueue() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    try {
      const data = await api.getPendingEvents();
      setEvents(data);
    } catch (e) {
      console.error("Failed to load pending events:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleClassify = async (
    eventId: number,
    category: string,
    project: string | null
  ) => {
    try {
      await api.reclassifyEvent(eventId, project, category, null);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (e) {
      console.error("Failed to reclassify:", e);
    }
  };

  const handleCreateRule = async (event: Event, category: string) => {
    try {
      await api.addRule({
        priority: 100,
        match_type: "app_name",
        match_value: event.app_name,
        target_category: category,
        target_project_id: null,
      });
    } catch (e) {
      console.error("Failed to create rule:", e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Review Queue
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {events.length} events need classification
          </p>
        </div>
        <button
          onClick={loadEvents}
          className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Refresh
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          All events are classified. Nice work!
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <ReviewItem
              key={event.id}
              event={event}
              onClassify={handleClassify}
              onCreateRule={handleCreateRule}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewItem({
  event,
  onClassify,
  onCreateRule,
}: {
  event: Event;
  onClassify: (id: number, category: string, project: string | null) => void;
  onCreateRule: (event: Event, category: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    event.category || "unknown"
  );
  const [project, setProject] = useState(event.project || "");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {event.app_name}
          </p>
          {event.window_title && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {event.window_title}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(event.start_time).toLocaleTimeString()} -{" "}
            {Math.round(event.duration_seconds / 60)}m
            {event.confidence > 0 && (
              <span className="ml-2">
                ({Math.round(event.confidence * 100)}% confidence)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>

          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="Project"
            className="text-xs px-2 py-1.5 w-24 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />

          <button
            onClick={() =>
              onClassify(event.id, selectedCategory, project || null)
            }
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save
          </button>

          <button
            onClick={() => {
              onClassify(event.id, selectedCategory, project || null);
              onCreateRule(event, selectedCategory);
            }}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Save and create a rule for this app"
          >
            + Rule
          </button>
        </div>
      </div>
    </div>
  );
}
