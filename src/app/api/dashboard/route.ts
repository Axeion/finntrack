import { NextResponse } from "next/server"
import { db } from "@/db"
import { accounts, transactions, sync_log } from "@/db/schema"
import { getCashFlowPlan, getMonthlyBillStatus } from "@/lib/bills"
import { sql, desc } from "drizzle-orm"

export async function GET() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const priorMonthEnd = monthStart
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    allAccounts,
    incomeRow,
    expensesRow,
    priorIncomeRow,
    priorExpensesRow,
    categoryRows,
    dailyRows,
    recentTxns,
    lastSyncRow,
  ] = await Promise.all([
    db.select().from(accounts),

    db
      .select({ total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
      .from(transactions)
      .where(
        sql`cast(${transactions.amount} as numeric) > 0 and ${transactions.posted} >= ${monthStart.toISOString()} and ${transactions.posted} < ${monthEnd.toISOString()}`
      ),

    db
      .select({ total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
      .from(transactions)
      .where(
        sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${monthStart.toISOString()} and ${transactions.posted} < ${monthEnd.toISOString()}`
      ),

    db
      .select({ total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
      .from(transactions)
      .where(
        sql`cast(${transactions.amount} as numeric) > 0 and ${transactions.posted} >= ${priorMonthStart.toISOString()} and ${transactions.posted} < ${priorMonthEnd.toISOString()}`
      ),

    db
      .select({ total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
      .from(transactions)
      .where(
        sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${priorMonthStart.toISOString()} and ${transactions.posted} < ${priorMonthEnd.toISOString()}`
      ),

    db
      .select({
        category: transactions.category,
        total: sql<string>`sum(abs(cast(${transactions.amount} as numeric)))`,
      })
      .from(transactions)
      .where(
        sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${monthStart.toISOString()} and ${transactions.posted} < ${monthEnd.toISOString()} and ${transactions.category} is not null`
      )
      .groupBy(transactions.category)
      .orderBy(sql`sum(abs(cast(${transactions.amount} as numeric))) desc`),

    db
      .select({
        date: sql<string>`date_trunc('day', ${transactions.posted})::date`,
        income: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) > 0 then cast(${transactions.amount} as numeric) else 0 end), 0)`,
        expenses: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) < 0 then abs(cast(${transactions.amount} as numeric)) else 0 end), 0)`,
      })
      .from(transactions)
      .where(sql`${transactions.posted} >= ${thirtyDaysAgo.toISOString()}`)
      .groupBy(sql`date_trunc('day', ${transactions.posted})::date`)
      .orderBy(sql`date_trunc('day', ${transactions.posted})::date`),

    db.select().from(transactions).orderBy(desc(transactions.posted)).limit(10),

    db.select().from(sync_log).orderBy(desc(sync_log.synced_at)).limit(1),
  ])

  const monthlyIncome = parseFloat(incomeRow[0].total)
  const monthlyExpenses = Math.abs(parseFloat(expensesRow[0].total))
  const priorMonthIncome = parseFloat(priorIncomeRow[0].total)
  const priorMonthExpenses = Math.abs(parseFloat(priorExpensesRow[0].total))
  const totalBalance = allAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0)

  const [cashFlow, billStatus] = await Promise.all([getCashFlowPlan(), getMonthlyBillStatus()])

  return NextResponse.json({
    accounts: allAccounts,
    monthlyIncome,
    monthlyExpenses,
    priorMonthIncome,
    priorMonthExpenses,
    totalBalance,
    categoryTotals: categoryRows.map((r) => ({ category: r.category, total: parseFloat(r.total) })),
    dailyTotals: dailyRows.map((r) => ({
      date: r.date,
      income: parseFloat(r.income),
      expenses: parseFloat(r.expenses),
    })),
    recentTransactions: recentTxns,
    cashFlow,
    billStatus,
    lastSync: lastSyncRow[0]?.synced_at ?? null,
  })
}
