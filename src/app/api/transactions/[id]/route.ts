import { NextRequest, NextResponse } from "next/server"
import { recategorizeTransaction } from "@/lib/categorize"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { category } = await req.json()

  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 })
  }

  try {
    const txn = await recategorizeTransaction(id, category)
    return NextResponse.json(txn)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
