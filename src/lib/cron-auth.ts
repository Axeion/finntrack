import { NextRequest } from "next/server"

export function validateCronSecret(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export function validateBotSecret(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${process.env.BOT_API_SECRET}`
}
