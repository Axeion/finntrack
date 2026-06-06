export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { transaction_splits, transactions } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const splits = await db.select().from(transaction_splits).where(eq(transaction_splits.transaction_id, id))
  return NextResponse.json(splits)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { splits } = await req.json() as { splits: { category: string; amount: number; note?: string }[] }

  if (!splits || splits.length < 2) return NextResponse.json({ error: "Need at least 2 splits" }, { status: 400 })

  // Verify total matches transaction amount
  const [txn] = await db.select().from(transactions).where(eq(transactions.id, id))
  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

  const txnAmt = Math.abs(parseFloat(txn.amount))
  const splitsTotal = splits.reduce((s, sp) => s + sp.amount, 0)
  if (Math.abs(splitsTotal - txnAmt) > 0.01) {
    return NextResponse.json({ error: `Splits total $${splitsTotal.toFixed(2)} must equal transaction $${txnAmt.toFixed(2)}` }, { status: 400 })
  }

  // Replace existing splits
  await db.delete(transaction_splits).where(eq(transaction_splits.transaction_id, id))
  const rows = await db.insert(transaction_splits).values(
    splits.map((s) => ({ transaction_id: id, category: s.category, amount: String(s.amount), note: s.note }))
  ).returning()

  // Set primary category to largest split
  const primary = splits.reduce((a, b) => a.amount >= b.amount ? a : b)
  await db.update(transactions).set({ category: primary.category, updated_at: new Date() }).where(eq(transactions.id, id))

  return NextResponse.json(rows)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(transaction_splits).where(eq(transaction_splits.transaction_id, id))
  return NextResponse.json({ ok: true })
}
