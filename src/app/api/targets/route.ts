export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { spending_targets, transactions } from "@/db/schema"
import { sql } from "drizzle-orm"

export async function GET() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [targets, spendingRows] = await Promise.all([
    db.select().from(spending_targets).where(sql`${spending_targets.is_active} = true`),
    db.select({
      category: transactions.category,
      total: sql<string>`sum(abs(cast(${transactions.amount} as numeric)))`,
    })
      .from(transactions)
      .where(sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${monthStart.toISOString()} and ${transactions.posted} < ${monthEnd.toISOString()} and ${transactions.category} is not null`)
      .groupBy(transactions.category),
  ])

  const spendingMap = Object.fromEntries(spendingRows.map((r) => [r.category, parseFloat(r.total)]))

  return NextResponse.json(targets.map((t) => ({
    ...t,
    monthly_limit: parseFloat(t.monthly_limit),
    spent: spendingMap[t.category] ?? 0,
    pct: ((spendingMap[t.category] ?? 0) / parseFloat(t.monthly_limit)) * 100,
  })))
}

export async function POST(req: NextRequest) {
  const { category, monthly_limit } = await req.json()
  if (!category || !monthly_limit) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  const [row] = await db.insert(spending_targets)
    .values({ category, monthly_limit: String(monthly_limit) })
    .onConflictDoUpdate({ target: spending_targets.category, set: { monthly_limit: String(monthly_limit), is_active: true, updated_at: new Date() } })
    .returning()
  return NextResponse.json(row)
}
