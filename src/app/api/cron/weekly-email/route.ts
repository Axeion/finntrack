export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { validateCronSecret } from "@/lib/cron-auth"
import { sendWeeklyReport } from "@/lib/notifications"

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await sendWeeklyReport()
  return NextResponse.json(result)
}
