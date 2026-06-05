export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { validateBotSecret } from "@/lib/cron-auth"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { sql } from "drizzle-orm"

export async function GET(req: NextRequest) {
  if (!validateBotSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const period = req.nextUrl.searchParams.get("period") ?? "yesterday"
  const now = new Date()

  let startDate: Date
  let endDate: Date = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  if (period === "yesterday") {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    startDate = yesterday
    endDate = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)
  } else if (period === "week") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const [totals, categoryRows, countRow] = await Promise.all([
    db
      .select({
        totalIn: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) > 0 then cast(${transactions.amount} as numeric) else 0 end), 0)`,
        totalOut: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) < 0 then abs(cast(${transactions.amount} as numeric)) else 0 end), 0)`,
      })
      .from(transactions)
      .where(
        sql`${transactions.posted} >= ${startDate.toISOString()} and ${transactions.posted} < ${endDate.toISOString()}`
      ),
    db
      .select({
        category: transactions.category,
        total: sql<string>`sum(abs(cast(${transactions.amount} as numeric)))`,
      })
      .from(transactions)
      .where(
        sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${startDate.toISOString()} and ${transactions.posted} < ${endDate.toISOString()} and ${transactions.category} is not null`
      )
      .groupBy(transactions.category)
      .orderBy(sql`sum(abs(cast(${transactions.amount} as numeric))) desc`)
      .limit(5),
    db
      .select({ count: sql<string>`count(*)` })
      .from(transactions)
      .where(
        sql`${transactions.posted} >= ${startDate.toISOString()} and ${transactions.posted} < ${endDate.toISOString()}`
      ),
  ])

  const totalIn = parseFloat(totals[0].totalIn)
  const totalOut = parseFloat(totals[0].totalOut)

  return NextResponse.json({
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    topCategories: categoryRows.map((r) => ({ category: r.category, total: parseFloat(r.total) })),
    transactionCount: parseInt(countRow[0].count),
  })
}
