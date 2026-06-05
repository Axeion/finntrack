const CATEGORY_COLORS: Record<string, string> = {
  "Income": "#10b981",
  "Groceries": "#34d399",
  "Dining & Restaurants": "#f97316",
  "Transportation": "#3b82f6",
  "Utilities & Bills": "#6366f1",
  "Subscriptions & Streaming": "#8b5cf6",
  "Shopping & Retail": "#ec4899",
  "Health & Medical": "#ef4444",
  "Housing & Rent": "#f59e0b",
  "Personal Care": "#14b8a6",
  "Entertainment": "#a78bfa",
  "Travel": "#0ea5e9",
  "Insurance": "#64748b",
  "Transfers & Payments": "#94a3b8",
  "Miscellaneous": "#475569",
}

export function getCategoryColor(category: string | null): string {
  return CATEGORY_COLORS[category ?? ""] ?? "#475569"
}

export default function CategoryPill({ category }: { category: string | null }) {
  const color = getCategoryColor(category)
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
      style={{ backgroundColor: color + "33", color, border: `1px solid ${color}66` }}
    >
      {category ?? "Uncategorized"}
    </span>
  )
}
