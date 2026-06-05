import { NextRequest, NextResponse } from "next/server"
import { validateCronSecret } from "@/lib/cron-auth"
import { runSync } from "@/lib/simplefin"
import { categorizePendingTransactions } from "@/lib/categorize"
import { matchBillsToTransactions } from "@/lib/bills"

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { accountsSynced, transactionsImported } = await runSync(2)
  const categorized = await categorizePendingTransactions()
  const billsMatched = await matchBillsToTransactions()

  return NextResponse.json({ accountsSynced, transactionsImported, categorized, billsMatched })
}
