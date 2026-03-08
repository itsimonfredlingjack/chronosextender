import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Event, Category } from "../lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";

interface CategoryPieChartProps {
  events: Event[];
}

function CenterLabel({ viewBox, totalHours }: { viewBox?: { cx: number; cy: number }; totalHours: number }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-800 text-xl font-bold">
        {totalHours.toFixed(1)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-500 text-[10px]">
        hours
      </text>
    </g>
  );
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
      category,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalHours = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No data yet
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
            <CenterLabel totalHours={totalHours} />
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)}h`, "Hours"]}
            contentStyle={{
              backgroundColor: "rgba(252, 248, 240, 0.95)",
              border: "1px solid #d7d0c3",
              borderRadius: "8px",
              color: "#1f2937",
              fontSize: "12px",
              backdropFilter: "blur(8px)",
              boxShadow: "0 10px 24px rgba(24, 33, 52, 0.12)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {data.map((d) => (
          <div key={d.category} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}
