import { pgTable, varchar, numeric, timestamp, boolean, integer, text, serial, jsonb } from "drizzle-orm/pg-core"

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  org: varchar("org").notNull(),
  balance: numeric("balance").notNull(),
  balance_date: timestamp("balance_date").notNull(),
  currency: varchar("currency").default("USD"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey(),
  account_id: varchar("account_id").references(() => accounts.id),
  posted: timestamp("posted").notNull(),
  amount: numeric("amount").notNull(),
  payee: varchar("payee").notNull(),
  memo: varchar("memo"),
  category: varchar("category"),
  category_confidence: numeric("category_confidence"),
  is_pending: boolean("is_pending").default(false),
  is_recurring: boolean("is_recurring").default(false),
  recurring_period: varchar("recurring_period"), // 'weekly' | 'monthly' | 'yearly'
  raw_description: varchar("raw_description").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})

// Splits for a single transaction across multiple categories
export const transaction_splits = pgTable("transaction_splits", {
  id: serial("id").primaryKey(),
  transaction_id: varchar("transaction_id").references(() => transactions.id).notNull(),
  category: varchar("category").notNull(),
  amount: numeric("amount").notNull(),
  note: varchar("note"),
  created_at: timestamp("created_at").defaultNow(),
})

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  amount: numeric("amount").notNull(),
  due_day: integer("due_day").notNull(),
  category: varchar("category").notNull(),
  is_variable: boolean("is_variable").default(false),
  is_active: boolean("is_active").default(true),
  payee_match: varchar("payee_match"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})

export const bill_payments = pgTable("bill_payments", {
  id: serial("id").primaryKey(),
  bill_id: integer("bill_id").references(() => bills.id),
  transaction_id: varchar("transaction_id").references(() => transactions.id),
  paid_date: timestamp("paid_date").notNull(),
  paid_amount: numeric("paid_amount").notNull(),
  month: varchar("month").notNull(),
  created_at: timestamp("created_at").defaultNow(),
})

// Auto-categorization rules: if payee matches pattern, apply category
export const categorization_rules = pgTable("categorization_rules", {
  id: serial("id").primaryKey(),
  payee_pattern: varchar("payee_pattern").notNull(), // substring match, case-insensitive
  category: varchar("category").notNull(),
  priority: integer("priority").default(0), // higher = checked first
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
})

// Soft spending targets per category per month
export const spending_targets = pgTable("spending_targets", {
  id: serial("id").primaryKey(),
  category: varchar("category").notNull().unique(),
  monthly_limit: numeric("monthly_limit").notNull(),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
})

// Monthly net worth snapshots for trend tracking
export const net_worth_snapshots = pgTable("net_worth_snapshots", {
  id: serial("id").primaryKey(),
  snapshot_date: timestamp("snapshot_date").notNull(),
  month: varchar("month").notNull().unique(), // 'YYYY-MM'
  total_assets: numeric("total_assets").notNull(),
  account_balances: jsonb("account_balances").notNull(), // { accountId: balance }
  created_at: timestamp("created_at").defaultNow(),
})

export const sync_log = pgTable("sync_log", {
  id: serial("id").primaryKey(),
  synced_at: timestamp("synced_at").defaultNow(),
  accounts_synced: integer("accounts_synced"),
  transactions_imported: integer("transactions_imported"),
  transactions_categorized: integer("transactions_categorized"),
  bills_matched: integer("bills_matched"),
  status: varchar("status"),
  error_message: text("error_message"),
})
