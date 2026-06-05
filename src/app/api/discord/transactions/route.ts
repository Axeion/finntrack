export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { validateBotSecret } from "@/lib/cron-auth"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { desc } from "drizzle-orm"

export async function GET(req: NextRequest) {
  if (!validateBotSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "10")))
  const rows = await db.select().from(transactions).orderBy(desc(transactions.posted)).limit(limit)

  return NextResponse.json({
    transactions: rows.map((t) => ({
      payee: t.payee,
      amount: parseFloat(t.amount),
      category: t.category,
      date: t.posted,
    })),
  })
}
