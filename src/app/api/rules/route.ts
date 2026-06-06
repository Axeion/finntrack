export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { categorization_rules } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET() {
  const rows = await db.select().from(categorization_rules).orderBy(desc(categorization_rules.priority), desc(categorization_rules.created_at))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { payee_pattern, category, priority } = await req.json()
  if (!payee_pattern || !category) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  const [row] = await db.insert(categorization_rules).values({
    payee_pattern,
    category,
    priority: priority ?? 0,
  }).returning()
  return NextResponse.json(row)
}
