export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { bills } from "@/db/schema"
import { eq } from "drizzle-orm"
import { createBill, getMonthlyBillStatus } from "@/lib/bills"

export async function GET() {
  const status = await getMonthlyBillStatus()
  return NextResponse.json(status)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const bill = await createBill(data)
  return NextResponse.json(bill, { status: 201 })
}
