import { NextRequest, NextResponse } from "next/server"
import { validateBotSecret } from "@/lib/cron-auth"
import { db } from "@/db"
import { accounts } from "@/db/schema"

export async function GET(req: NextRequest) {
  if (!validateBotSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db.select().from(accounts)
  return NextResponse.json({
    accounts: rows.map((a) => ({
      name: a.name,
      org: a.org,
      balance: parseFloat(a.balance),
      balanceDate: a.balance_date,
    })),
  })
}
