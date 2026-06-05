export const CATEGORIES = [
  "Income",
  "Groceries",
  "Dining & Restaurants",
  "Transportation",
  "Utilities & Bills",
  "Subscriptions & Streaming",
  "Shopping & Retail",
  "Health & Medical",
  "Housing & Rent",
  "Personal Care",
  "Entertainment",
  "Travel",
  "Insurance",
  "Transfers & Payments",
  "Miscellaneous",
] as const

export type Category = (typeof CATEGORIES)[number]
