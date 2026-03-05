import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Event, Category } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";

interface CategoryPieChartProps {
  events: Event[];
}

export default function CategoryPieChart({ events }: CategoryPieChartProps) {
  const categoryMap: Record<string, number> = {};

  for (const event of events) {
    const cat = event.category || "unknown";
    categoryMap[cat] = (categoryMap[cat] || 0) + event.duration_seconds;
  }

  const data = Object.entries(categoryMap)
    .map(([category, seconds]) => ({
      name: CATEGORY_LABELS[category as Category] || category,
      value: Math.round((seconds / 3600) * 100) / 100,
      color: CATEGORY_COLORS[category as Category] || CATEGORY_COLORS.unknown,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(2)}h`, "Hours"]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
