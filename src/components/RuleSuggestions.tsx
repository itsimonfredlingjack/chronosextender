import { useState, useEffect } from "react";
import { api } from "../lib/tauri";
import type { RuleSuggestion } from "../lib/types";

export default function RuleSuggestions() {
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getRuleSuggestions().then(setSuggestions).catch(console.error);
  }, []);

  const handleAccept = async (suggestion: RuleSuggestion) => {
    try {
      await api.addRule({
        priority: null,
        match_type: "app_name",
        match_value: suggestion.app_name,
        target_category: suggestion.suggested_category,
        target_project_id: null,
      });
      setSuggestions((prev) =>
        prev.filter((s) => s.app_name !== suggestion.app_name)
      );
    } catch (e) {
      console.error("Failed to add rule:", e);
    }
  };

  const handleDismiss = (appName: string) => {
    setDismissed((prev) => new Set(prev).add(appName));
  };

  const visible = suggestions.filter((s) => !dismissed.has(s.app_name));
  if (visible.length === 0) return null;

  return (
    <div className="bg-amber-900/20 rounded-xl p-5 border border-amber-800/40 card-elevated">
      <h3 className="text-sm font-medium text-amber-200 mb-3">
        Rule Suggestions
      </h3>
      <div className="space-y-2">
        {visible.map((s) => (
          <div key={s.app_name} className="flex items-center gap-3 text-sm">
            <span className="text-gray-300 flex-1">
              <strong>{s.app_name}</strong> is always{" "}
              <span className="text-indigo-400">{s.suggested_category}</span>
              <span className="text-xs text-gray-500 ml-1">
                ({s.event_count} events)
              </span>
            </span>
            <button
              onClick={() => handleAccept(s)}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Accept
            </button>
            <button
              onClick={() => handleDismiss(s.app_name)}
              className="px-3 py-1 text-xs bg-[#22223a] text-gray-300 rounded-lg hover:bg-[#2a2a40]"
            >
              Ignore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
