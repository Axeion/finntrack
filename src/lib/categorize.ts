import { db } from "@/db"
import { transactions } from "@/db/schema"
import { isNull, sql } from "drizzle-orm"
import { eq } from "drizzle-orm"
import { CATEGORIES } from "./constants"

const SYSTEM_PROMPT = `You are a personal finance transaction categorizer. Classify each transaction into exactly one of these categories:
Income, Groceries, Dining & Restaurants, Transportation, Utilities & Bills,
Subscriptions & Streaming, Shopping & Retail, Health & Medical, Housing & Rent,
Personal Care, Entertainment, Travel, Insurance, Transfers & Payments, Miscellaneous

Rules:
- Positive amounts are typically Income or Transfers & Payments
- Negative amounts are expenses
- Return ONLY valid JSON: {"category": "Category Name", "confidence": 0.95}
- confidence is a float 0.0–1.0
- No explanation, no text outside the JSON object`

export async function categorizeTransaction(
  payee: string,
  amount: number,
  memo?: string
): Promise<{ category: string; confidence: number }> {
  try {
    const baseUrl = process.env.OLLAMA_BASE_URL
    const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b"

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Payee: "${payee}"\nAmount: $${amount}\nMemo: ${memo ?? "none"}`,
          },
        ],
        temperature: 0.1,
      }),
    })

    if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`)

    const data = await res.json()
    const raw: string = data.choices?.[0]?.message?.content ?? ""
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(cleaned)

    const category = CATEGORIES.includes(parsed.category) ? parsed.category : "Miscellaneous"
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0

    return { category, confidence }
  } catch {
    return { category: "Miscellaneous", confidence: 0 }
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function categorizePendingTransactions(limit = 50): Promise<number> {
  const pending = await db
    .select()
    .from(transactions)
    .where(isNull(transactions.category))
    .limit(limit)

  let count = 0
  for (const txn of pending) {
    const { category, confidence } = await categorizeTransaction(
      txn.payee,
      parseFloat(txn.amount),
      txn.memo ?? undefined
    )

    await db
      .update(transactions)
      .set({
        category,
        category_confidence: confidence.toString(),
        updated_at: new Date(),
      })
      .where(eq(transactions.id, txn.id))

    count++
    if (count < pending.length) await delay(150)
  }

  return count
}

export async function recategorizeTransaction(transactionId: string, category: string) {
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error(`Invalid category: ${category}`)
  }

  const [updated] = await db
    .update(transactions)
    .set({
      category,
      category_confidence: "1.0",
      updated_at: new Date(),
    })
    .where(eq(transactions.id, transactionId))
    .returning()

  return updated
}
