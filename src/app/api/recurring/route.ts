export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { sql, desc } from "drizzle-orm"

interface RecurringGroup {
  payee: string
  period: string
  amount: number
  count: number
  lastSeen: string
  category: string | null
}

function detectPeriod(dates: Date[]): string | null {
  if (dates.length < 2) return null
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24))
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const maxDeviation = Math.max(...gaps.map((g) => Math.abs(g - avg)))

  // Only flag as recurring if gaps are consistent (low deviation)
  if (maxDeviation > avg * 0.4) return null

  if (avg >= 6 && avg <= 8) return "weekly"
  if (avg >= 13 && avg <= 16) return "biweekly"
  if (avg >= 25 && avg <= 35) return "monthly"
  if (avg >= 85 && avg <= 95) return "quarterly"
  if (avg >= 350 && avg <= 380) return "yearly"
  return null
}

export async function GET() {
  // Get all expense transactions from last 13 months
  const since = new Date()
  since.setMonth(since.getMonth() - 13)

  const rows = await db.select({
    payee: transactions.payee,
    amount: transactions.amount,
    posted: transactions.posted,
    category: transactions.category,
  })
    .from(transactions)
    .where(sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${since.toISOString()}`)
    .orderBy(desc(transactions.posted))

  // Group by payee + rounded amount (±5%)
  const groups = new Map<string, { dates: Date[]; amounts: number[]; category: string | null }>()

  for (const row of rows) {
    const amt = Math.abs(parseFloat(row.amount))
    const roundedAmt = Math.round(amt / 5) * 5 // group within $5 buckets
    const key = `${row.payee.toLowerCase().trim()}::${roundedAmt}`
    if (!groups.has(key)) groups.set(key, { dates: [], amounts: [], category: row.category })
    groups.get(key)!.dates.push(new Date(row.posted))
    groups.get(key)!.amounts.push(amt)
  }

  const recurring: RecurringGroup[] = []

  for (const [key, { dates, amounts, category }] of groups) {
    if (dates.length < 2) continue
    const period = detectPeriod(dates)
    if (!period) continue

    const payee = key.split("::")[0]
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const lastSeen = dates.reduce((a, b) => a > b ? a : b)

    recurring.push({
      payee: rows.find((r) => r.payee.toLowerCase().trim() === payee)?.payee ?? payee,
      period,
      amount: avgAmount,
      count: dates.length,
      lastSeen: lastSeen.toISOString(),
      category,
    })
  }

  // Sort by amount desc
  recurring.sort((a, b) => b.amount - a.amount)

  return NextResponse.json(recurring)
}
