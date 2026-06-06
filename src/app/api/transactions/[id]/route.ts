export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { eq, ilike, sql, desc } from "drizzle-orm"
import { recategorizeTransaction } from "@/lib/categorize"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [txn] = await db.select().from(transactions).where(eq(transactions.id, id))
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Fetch other transactions from same payee (last 20)
  const related = await db.select().from(transactions)
    .where(sql`${transactions.payee} ilike ${`%${txn.payee}%`} and ${transactions.id} != ${id}`)
    .orderBy(desc(transactions.posted))
    .limit(20)

  return NextResponse.json({ transaction: txn, related })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // If only category is being set, use the validated recategorize path
  if (Object.keys(body).length === 1 && body.category) {
    try {
      const txn = await recategorizeTransaction(id, body.category)
      return NextResponse.json(txn)
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 400 })
    }
  }

  // Otherwise update allowed fields directly
  const allowed: Record<string, unknown> = {}
  if (body.payee !== undefined) allowed.payee = body.payee
  if (body.memo !== undefined) allowed.memo = body.memo
  if (body.category !== undefined) allowed.category = body.category
  allowed.updated_at = new Date()

  const [updated] = await db.update(transactions).set(allowed).where(eq(transactions.id, id)).returning()
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(transactions).where(eq(transactions.id, id))
  return NextResponse.json({ ok: true })
}
