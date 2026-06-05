export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { validateCronSecret } from "@/lib/cron-auth"
import { runSync } from "@/lib/simplefin"
import { categorizePendingTransactions } from "@/lib/categorize"
import { matchBillsToTransactions } from "@/lib/bills"

export const maxDuration = 60 // seconds — requires Vercel Pro for >10s, but set it anyway

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const daysBack = parseInt(req.nextUrl.searchParams.get("daysBack") ?? "2")

  try {
    const { accountsSynced, transactionsImported } = await runSync(daysBack)
    const categorized = await categorizePendingTransactions(10) // small batch to avoid timeout
    const billsMatched = await matchBillsToTransactions()
    return NextResponse.json({ accountsSynced, transactionsImported, categorized, billsMatched })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error("Sync error:", err)
    return NextResponse.json({ error: message, stack }, { status: 500 })
  }
}
