export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { validateCronSecret } from "@/lib/cron-auth"
import { categorizePendingTransactions } from "@/lib/categorize"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { isNull, sql } from "drizzle-orm"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const batch = parseInt(req.nextUrl.searchParams.get("batch") ?? "10")

  try {
    const categorized = await categorizePendingTransactions(batch)

    // Count how many still remain
    const [remaining] = await db
      .select({ count: sql<string>`count(*)` })
      .from(transactions)
      .where(isNull(transactions.category))

    return NextResponse.json({ categorized, remaining: parseInt(remaining.count) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
