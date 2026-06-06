export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { spending_targets } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (body.monthly_limit) body.monthly_limit = String(body.monthly_limit)
  const [row] = await db.update(spending_targets).set({ ...body, updated_at: new Date() }).where(eq(spending_targets.id, parseInt(id))).returning()
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.update(spending_targets).set({ is_active: false, updated_at: new Date() }).where(eq(spending_targets.id, parseInt(id)))
  return NextResponse.json({ ok: true })
}
