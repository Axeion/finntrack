import { NextRequest, NextResponse } from "next/server"
import { validateBotSecret } from "@/lib/cron-auth"
import { getCashFlowPlan } from "@/lib/bills"

export async function GET(req: NextRequest) {
  if (!validateBotSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await getCashFlowPlan()
  return NextResponse.json(data)
}
