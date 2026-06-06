export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { net_worth_snapshots, accounts } from "@/db/schema"
import { sql, asc } from "drizzle-orm"

export async function GET() {
  const [snapshots, currentAccounts] = await Promise.all([
    db.select().from(net_worth_snapshots).orderBy(asc(net_worth_snapshots.snapshot_date)),
    db.select().from(accounts),
  ])

  const currentTotal = currentAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0)

  // Build a current "snapshot" for this month
  const currentMonth = new Date().toISOString().slice(0, 7)
  const hasCurrentMonth = snapshots.some((s) => s.month === currentMonth)

  const history = snapshots.map((s) => ({
    month: s.month,
    total: parseFloat(s.total_assets),
  }))

  if (!hasCurrentMonth) {
    history.push({ month: currentMonth, total: currentTotal })
  }

  return NextResponse.json({
    history,
    current: currentTotal,
    accounts: currentAccounts.map((a) => ({ id: a.id, name: a.name, balance: parseFloat(a.balance) })),
  })
}

// Called by cron to save a snapshot
export async function POST() {
  const allAccounts = await db.select().from(accounts)
  const total = allAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0)
  const month = new Date().toISOString().slice(0, 7)
  const balanceMap = Object.fromEntries(allAccounts.map((a) => [a.id, parseFloat(a.balance)]))

  await db.insert(net_worth_snapshots)
    .values({ snapshot_date: new Date(), month, total_assets: String(total), account_balances: balanceMap })
    .onConflictDoUpdate({ target: net_worth_snapshots.month, set: { total_assets: String(total), account_balances: balanceMap, snapshot_date: new Date() } })

  return NextResponse.json({ month, total })
}
