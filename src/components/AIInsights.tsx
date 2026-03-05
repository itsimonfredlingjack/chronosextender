import { useMemo } from "react";
import type { Event } from "../lib/types";
import { generateInsights } from "../lib/insights";

interface AIInsightsProps {
  events: Event[];
}

const TYPE_STYLES = {
  positive: "border-l-green-500 dark:border-l-green-400",
  warning: "border-l-amber-500 dark:border-l-amber-400",
  neutral: "border-l-indigo-500 dark:border-l-indigo-400",
};

export default function AIInsights({ events }: AIInsightsProps) {
  const insights = useMemo(() => generateInsights(events), [events]);

  if (insights.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#1a1a2e] dark:glass-card rounded-xl p-5 border border-gray-200 dark:border-[#2a2a40]">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span>&#x2728;</span> AI Insights
      </h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`border-l-2 pl-3 py-2 text-sm text-gray-700 dark:text-gray-300 animate-[fade-in_0.3s_ease-out_backwards] ${TYPE_STYLES[insight.type]}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {insight.text}
          </div>
        ))}
      </div>
    </div>
  );
}
