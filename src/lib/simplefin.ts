import { db } from "@/db"
import { accounts, transactions, sync_log } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

interface SimpleFINTransaction {
  id: string
  posted: number
  amount: string
  description: string
  pending: boolean
}

interface SimpleFINAccount {
  id: string
  name: string
  org: { name: string }
  balance: string
  "balance-date": number
  currency: string
  transactions: SimpleFINTransaction[]
}

interface SimpleFINResponse {
  errors: string[]
  accounts: SimpleFINAccount[]
}

export async function fetchSimpleFINData(startDate?: Date): Promise<SimpleFINResponse> {
  const accessUrl = process.env.SIMPLEFIN_ACCESS_URL
  if (!accessUrl) throw new Error("SIMPLEFIN_ACCESS_URL is not set")

  // Parse credentials out of URL — Node.js fetch blocks URLs with embedded credentials
  const parsed = new URL(accessUrl)
  const username = parsed.username
  const password = parsed.password
  parsed.username = ""
  parsed.password = ""

  // Append /accounts if not already present
  const base = parsed.toString().replace(/\/$/, "")
  const url = new URL(`${base}/accounts`)
  if (startDate) {
    url.searchParams.set("start-date", Math.floor(startDate.getTime() / 1000).toString())
  }

  const headers: Record<string, string> = {}
  if (username || password) {
    headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
  }

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) throw new Error(`SimpleFIN request failed: ${res.status} ${res.statusText}`)

  const data: SimpleFINResponse = await res.json()
  if (data.errors?.length) throw new Error(`SimpleFIN errors: ${data.errors.join(", ")}`)

  return data
}

export async function syncAccounts(sfAccounts: SimpleFINAccount[]): Promise<number> {
  for (const acc of sfAccounts) {
    await db
      .insert(accounts)
      .values({
        id: acc.id,
        name: acc.name,
        org: acc.org.name,
        balance: acc.balance,
        balance_date: new Date(acc["balance-date"] * 1000),
        currency: acc.currency ?? "USD",
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          balance: acc.balance,
          balance_date: new Date(acc["balance-date"] * 1000),
          updated_at: new Date(),
        },
      })
  }
  return sfAccounts.length
}

export async function syncTransactions(sfAccounts: SimpleFINAccount[]): Promise<number> {
  let inserted = 0
  for (const acc of sfAccounts) {
    for (const txn of acc.transactions ?? []) {
      const result = await db
        .insert(transactions)
        .values({
          id: txn.id,
          account_id: acc.id,
          posted: new Date(txn.posted * 1000),
          amount: txn.amount,
          payee: txn.description,
          raw_description: txn.description,
          is_pending: txn.pending ?? false,
        })
        .onConflictDoNothing()
      if (result.rowCount && result.rowCount > 0) inserted++
    }
  }
  return inserted
}

export async function runSync(daysBack = 2): Promise<{ accountsSynced: number; transactionsImported: number }> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  try {
    const data = await fetchSimpleFINData(startDate)
    const accountsSynced = await syncAccounts(data.accounts)
    const transactionsImported = await syncTransactions(data.accounts)

    await db.insert(sync_log).values({
      accounts_synced: accountsSynced,
      transactions_imported: transactionsImported,
      status: "success",
    })

    return { accountsSynced, transactionsImported }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.insert(sync_log).values({
      status: "error",
      error_message: message,
    })
    throw err
  }
}
