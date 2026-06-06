export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { sql } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const startDate = params.get("startDate")
  const endDate = params.get("endDate")
  const accountId = params.get("accountId")

  const now = new Date()
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const accountFilter = accountId ? sql` and ${transactions.account_id} = ${accountId}` : sql``

  const [categoryRows, monthlyRows, topPayees] = await Promise.all([
    // Category breakdown for range
    db.select({
      category: transactions.category,
      total: sql<string>`sum(abs(cast(${transactions.amount} as numeric)))`,
      count: sql<string>`count(*)`,
    })
      .from(transactions)
      .where(sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${start.toISOString()} and ${transactions.posted} < ${end.toISOString()} and ${transactions.category} is not null${accountFilter}`)
      .groupBy(transactions.category)
      .orderBy(sql`sum(abs(cast(${transactions.amount} as numeric))) desc`),

    // Monthly totals for trend chart (income + expenses per month)
    db.select({
      month: sql<string>`to_char(date_trunc('month', ${transactions.posted}), 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) > 0 then cast(${transactions.amount} as numeric) else 0 end), 0)`,
      expenses: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) < 0 then abs(cast(${transactions.amount} as numeric)) else 0 end), 0)`,
    })
      .from(transactions)
      .where(sql`${transactions.posted} >= ${start.toISOString()} and ${transactions.posted} < ${end.toISOString()}${accountFilter}`)
      .groupBy(sql`date_trunc('month', ${transactions.posted})`)
      .orderBy(sql`date_trunc('month', ${transactions.posted})`),

    // Top payees by spend
    db.select({
      payee: transactions.payee,
      total: sql<string>`sum(abs(cast(${transactions.amount} as numeric)))`,
      count: sql<string>`count(*)`,
      category: transactions.category,
    })
      .from(transactions)
      .where(sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${start.toISOString()} and ${transactions.posted} < ${end.toISOString()}${accountFilter}`)
      .groupBy(transactions.payee, transactions.category)
      .orderBy(sql`sum(abs(cast(${transactions.amount} as numeric))) desc`)
      .limit(20),
  ])

  // Monthly breakdown by category
  const categoryMonthlyRows = await db.select({
    month: sql<string>`to_char(date_trunc('month', ${transactions.posted}), 'YYYY-MM')`,
    category: transactions.category,
    total: sql<string>`sum(abs(cast(${transactions.amount} as numeric)))`,
  })
    .from(transactions)
    .where(sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${start.toISOString()} and ${transactions.posted} < ${end.toISOString()} and ${transactions.category} is not null${accountFilter}`)
    .groupBy(sql`date_trunc('month', ${transactions.posted})`, transactions.category)
    .orderBy(sql`date_trunc('month', ${transactions.posted})`)

  return NextResponse.json({
    categoryTotals: categoryRows.map((r) => ({ category: r.category, total: parseFloat(r.total), count: parseInt(r.count) })),
    monthlyTotals: monthlyRows.map((r) => ({ month: r.month, income: parseFloat(r.income), expenses: parseFloat(r.expenses), net: parseFloat(r.income) - parseFloat(r.expenses) })),
    topPayees: topPayees.map((r) => ({ payee: r.payee, total: parseFloat(r.total), count: parseInt(r.count), category: r.category })),
    categoryMonthly: categoryMonthlyRows.map((r) => ({ month: r.month, category: r.category, total: parseFloat(r.total) })),
    dateRange: { start: start.toISOString(), end: end.toISOString() },
  })
}
