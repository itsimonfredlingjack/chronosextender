import type { Category } from "../lib/types";
import { CATEGORY_COLORS } from "../lib/types";

interface Props {
  categories: { category: Category; seconds: number }[];
}

export default function CategoryMiniBar({ categories }: Props) {
  const total = categories.reduce((sum, c) => sum + c.seconds, 0);
  if (total === 0) return null;

  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-[#12121e]">
      {categories.map((c) => (
        <div
          key={c.category}
          className="h-full transition-all"
          style={{
            width: `${(c.seconds / total) * 100}%`,
            backgroundColor: CATEGORY_COLORS[c.category] || CATEGORY_COLORS.unknown,
          }}
        />
      ))}
    </div>
  );
}
