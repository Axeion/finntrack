import { db } from "@/db"
import { bills, bill_payments, transactions } from "@/db/schema"
import { and, eq, isNull, isNotNull, sql, lt, lte } from "drizzle-orm"

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export async function matchBillsToTransactions(month?: string): Promise<number> {
  const targetMonth = month ?? currentMonth()
  const [year, mon] = targetMonth.split("-").map(Number)
  const monthStart = new Date(year, mon - 1, 1)
  const monthEnd = new Date(year, mon, 1)

  const activeBills = await db
    .select()
    .from(bills)
    .where(and(eq(bills.is_active, true), isNotNull(bills.payee_match)))

  let matched = 0

  for (const bill of activeBills) {
    const existingPayment = await db
      .select()
      .from(bill_payments)
      .where(and(eq(bill_payments.bill_id, bill.id), eq(bill_payments.month, targetMonth)))
      .limit(1)

    if (existingPayment.length > 0) continue

    const billAmount = parseFloat(bill.amount)
    const tolerance = billAmount * 0.3

    const matchedTxns = await db
      .select()
      .from(transactions)
      .where(
        and(
          sql`lower(${transactions.payee}) like lower(${"%" + bill.payee_match + "%"})`,
          sql`cast(${transactions.amount} as numeric) < 0`,
          sql`abs(cast(${transactions.amount} as numeric)) between ${(billAmount - tolerance).toFixed(2)} and ${(billAmount + tolerance).toFixed(2)}`,
          sql`${transactions.posted} >= ${monthStart.toISOString()}`,
          sql`${transactions.posted} < ${monthEnd.toISOString()}`
        )
      )
      .limit(1)

    if (matchedTxns.length === 0) continue

    const txn = matchedTxns[0]
    await db.insert(bill_payments).values({
      bill_id: bill.id,
      transaction_id: txn.id,
      paid_date: txn.posted,
      paid_amount: String(Math.abs(parseFloat(txn.amount))),
      month: targetMonth,
    })

    await db
      .update(transactions)
      .set({ category: bill.category, updated_at: new Date() })
      .where(eq(transactions.id, txn.id))

    matched++
  }

  return matched
}

type BillStatus = "paid" | "due_soon" | "overdue" | "upcoming"

export async function getMonthlyBillStatus(month?: string) {
  const targetMonth = month ?? currentMonth()
  const today = new Date().getDate()

  const activeBills = await db.select().from(bills).where(eq(bills.is_active, true))

  const results = await Promise.all(
    activeBills.map(async (bill) => {
      const [payment] = await db
        .select()
        .from(bill_payments)
        .where(and(eq(bill_payments.bill_id, bill.id), eq(bill_payments.month, targetMonth)))
        .limit(1)

      let status: BillStatus
      if (payment) {
        status = "paid"
      } else if (today > bill.due_day) {
        status = "overdue"
      } else if (bill.due_day - today <= 3) {
        status = "due_soon"
      } else {
        status = "upcoming"
      }

      return { bill, payment: payment ?? null, status }
    })
  )

  return results
}

export async function getCashFlowPlan() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [incomeRow] = await db
    .select({ total: sql<string>`coalesce(sum(cast(${transactions.amount} as numeric)), 0)` })
    .from(transactions)
    .where(
      and(
        sql`cast(${transactions.amount} as numeric) > 0`,
        sql`${transactions.posted} >= ${monthStart.toISOString()}`,
        sql`${transactions.posted} < ${monthEnd.toISOString()}`
      )
    )

  const income = parseFloat(incomeRow.total ?? "0")

  const allActiveBills = await db.select().from(bills).where(eq(bills.is_active, true))
  const totalBills = allActiveBills.reduce((sum, b) => sum + parseFloat(b.amount), 0)
  const discretionary = income - totalBills
  const billsPercent = income > 0 ? (totalBills / income) * 100 : 0

  const today = new Date().getDate()
  const targetMonth = currentMonth()

  const billStatuses = await getMonthlyBillStatus(targetMonth)
  const upcomingUnpaid = billStatuses
    .filter((b) => b.status !== "paid")
    .map((b) => b.bill)
    .sort((a, b) => a.due_day - b.due_day)

  return { income, totalBills, discretionary, billsPercent, upcomingUnpaid }
}

export async function getUpcomingBills(daysAhead = 7) {
  const today = new Date().getDate()
  const targetMonth = currentMonth()

  const billStatuses = await getMonthlyBillStatus(targetMonth)
  return billStatuses
    .filter((b) => b.status !== "paid" && b.bill.due_day >= today && b.bill.due_day <= today + daysAhead)
    .map((b) => b.bill)
    .sort((a, b) => a.due_day - b.due_day)
}

export async function createBill(data: {
  name: string
  amount: string
  due_day: number
  category: string
  is_variable?: boolean
  payee_match?: string
  notes?: string
}) {
  const [bill] = await db.insert(bills).values(data).returning()
  return bill
}

export async function updateBill(id: number, data: Partial<typeof bills.$inferInsert>) {
  const [bill] = await db
    .update(bills)
    .set({ ...data, updated_at: new Date() })
    .where(eq(bills.id, id))
    .returning()
  return bill
}

export async function deactivateBill(id: number) {
  const [bill] = await db
    .update(bills)
    .set({ is_active: false, updated_at: new Date() })
    .where(eq(bills.id, id))
    .returning()
  return bill
}
