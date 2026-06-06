export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { transactions, bill_payments, transaction_splits, net_worth_snapshots, categorization_rules, spending_targets } from "@/db/schema"
import { sql } from "drizzle-orm"

export async function POST(req: NextRequest) {
  const { action } = await req.json()

  if (action === "reset-categories") {
    // Clear all AI-assigned categories (confidence < 1.0), keep user-confirmed ones
    const result = await db.update(transactions)
      .set({ category: null, category_confidence: null, updated_at: new Date() })
      .where(sql`(${transactions.category_confidence} is null or cast(${transactions.category_confidence} as numeric) < 1.0)`)
    return NextResponse.json({ ok: true, message: "Categories cleared. Run sync or categorize to re-process." })
  }

  if (action === "reset-categories-all") {
    // Clear ALL categories including user-confirmed
    await db.update(transactions).set({ category: null, category_confidence: null, updated_at: new Date() })
    return NextResponse.json({ ok: true, message: "All categories cleared." })
  }

  if (action === "delete-transactions") {
    // Delete all transactions and related data
    await db.delete(transaction_splits)
    await db.delete(bill_payments)
    await db.delete(transactions)
    return NextResponse.json({ ok: true, message: "All transactions deleted." })
  }

  if (action === "delete-all-data") {
    // Full reset — everything except accounts (SimpleFIN re-syncs those)
    await db.delete(transaction_splits)
    await db.delete(bill_payments)
    await db.delete(transactions)
    await db.delete(net_worth_snapshots)
    await db.delete(categorization_rules)
    await db.delete(spending_targets)
    return NextResponse.json({ ok: true, message: "All data reset." })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
