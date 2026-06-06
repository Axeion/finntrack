export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { categorization_rules } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const [row] = await db.update(categorization_rules)
    .set({ ...body })
    .where(eq(categorization_rules.id, parseInt(id)))
    .returning()
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.update(categorization_rules)
    .set({ is_active: false })
    .where(eq(categorization_rules.id, parseInt(id)))
  return NextResponse.json({ ok: true })
}
