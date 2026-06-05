import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { sql, desc, and, ilike } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(params.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")))
  const category = params.get("category")
  const startDate = params.get("startDate")
  const endDate = params.get("endDate")
  const search = params.get("search")

  const conditions = []
  if (category) conditions.push(sql`${transactions.category} = ${category}`)
  if (startDate) conditions.push(sql`${transactions.posted} >= ${new Date(startDate).toISOString()}`)
  if (endDate) conditions.push(sql`${transactions.posted} <= ${new Date(endDate).toISOString()}`)
  if (search) conditions.push(ilike(transactions.payee, `%${search}%`))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.posted))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<string>`count(*)` })
      .from(transactions)
      .where(where),
  ])

  const total = parseInt(countRow[0].count)

  return NextResponse.json({
    transactions: rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
