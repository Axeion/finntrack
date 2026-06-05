export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { validateCronSecret } from "@/lib/cron-auth"
import { sendDailyReport } from "@/lib/notifications"

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await sendDailyReport()
  return NextResponse.json(result)
}
