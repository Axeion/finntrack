import { NextRequest, NextResponse } from "next/server"
import { updateBill, deactivateBill } from "@/lib/bills"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()
  const bill = await updateBill(parseInt(id), data)
  return NextResponse.json(bill)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deactivateBill(parseInt(id))
  return NextResponse.json({ success: true })
}
