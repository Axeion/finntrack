import { db } from "@/db"
import { transactions, categorization_rules } from "@/db/schema"
import { isNull, eq, desc, sql } from "drizzle-orm"
import { CATEGORIES } from "./constants"

// Rule-based keyword categorizer — runs instantly, no external calls
const RULES: { pattern: RegExp; category: string }[] = [
  // Income
  { pattern: /payroll|direct deposit|adp|gusto|paychex|salary|wage|zelle in|venmo in/i, category: "Income" },

  // Groceries
  { pattern: /walmart|kroger|safeway|albertsons|publix|aldi|trader joe|whole foods|costco|sam.?s club|food lion|heb |wegmans|meijer|sprouts|fresh market|piggly|winn.?dixie|market basket|stater bros|giant food|stop.?shop/i, category: "Groceries" },

  // Dining & Restaurants
  { pattern: /mcdonald|chick.?fil|taco bell|wendy.?s|burger king|subway|chipotle|domino|pizza hut|papa john|panera|starbucks|dunkin|doordash|grubhub|ubereats|uber eats|postmates|instacart|dine|restaurant|cafe|coffee|sushi|kitchen|grill|bbq|steakhouse|waffle house|ihop|denny.?s|olive garden|applebee|chili.?s|buffalo wild|five guys|in.?n.?out|sonic drive|raising cane|wingstop|panda express|jersey mike|jimmy john|firehouse/i, category: "Dining & Restaurants" },

  // Transportation
  { pattern: /uber(?! eats)|lyft|taxi|shell|bp |exxon|chevron|mobil|marathon|sunoco|speedway|wawa|pilot flying|loves travel|gas station|gasoline|fuel|parking|garage|toll|ez.?pass|i.?pass|fastrak|mta |cta |bart |metro|transit|amtrak|greyhound|auto repair|jiffy lube|firestone|midas|pep boys|advance auto|o.?reilly auto|napa auto/i, category: "Transportation" },

  // Utilities & Bills
  { pattern: /electric|gas bill|water bill|utility|utilities|xfinity|comcast|spectrum|att |at&t|verizon|t.?mobile|sprint|cricket|boost mobile|metro pcs|centurylink|frontier comm|dish network|directv|trash|waste management|sewage|pge |pepco|duke energy|dominion energy|con edison|national grid/i, category: "Utilities & Bills" },

  // Subscriptions & Streaming
  { pattern: /netflix|spotify|hulu|disney\+|disney plus|apple\.com\/bill|apple one|amazon prime|prime video|youtube premium|youtube tv|paramount\+|paramount plus|peacock|hbo max|max\.com|showtime|starz|sling|fubo|crunchyroll|dropbox|icloud|google one|microsoft 365|adobe|canva|github|chatgpt|openai|patreon|substack/i, category: "Subscriptions & Streaming" },

  // Shopping & Retail
  { pattern: /amazon(?! prime)|amzn|target|best buy|home depot|lowe.?s|ikea|wayfair|etsy|ebay|chewy|petco|petsmart|dollar tree|dollar general|family dollar|five below|tj maxx|marshalls|ross stores|burlington|old navy|gap |h&m |zara |uniqlo|nordstrom|macy.?s|kohls|jcpenney|bed bath|crate.?barrel|pottery barn|williams.?sonoma|office depot|staples/i, category: "Shopping & Retail" },

  // Health & Medical
  { pattern: /cvs|walgreens|rite aid|pharmacy|medical|doctor|hospital|clinic|dental|dentist|orthodon|vision|optometrist|eye care|urgent care|emergency|health|insurance claim|lab corp|quest diag|anthem|aetna|cigna|humana|united health|blue cross|blue shield|kaiser/i, category: "Health & Medical" },

  // Housing & Rent
  { pattern: /rent|lease|mortgage|hoa |homeowner|property management|apartments\.com|zillow|realtor|realty|real estate/i, category: "Housing & Rent" },

  // Personal Care
  { pattern: /salon|barber|haircut|spa |nail |waxing|massage|ulta|sephora|bath.?body|great clips|sport clips|fantastic sam/i, category: "Personal Care" },

  // Entertainment
  { pattern: /cinema|movie|amc |regal |cinemark|ticketmaster|stubhub|eventbrite|concert|theater|theatre|museum|zoo |aquarium|bowling|arcade|golf |mini golf|escape room|dave.?buster|chuck e|steam |playstation|xbox |nintendo|gamestop|twitch/i, category: "Entertainment" },

  // Travel
  { pattern: /airline|airways|united air|delta air|southwest|american air|jetblue|frontier air|spirit air|allegiant|hotel|marriott|hilton|hyatt|sheraton|holiday inn|best western|airbnb|vrbo|expedia|booking\.com|kayak|priceline|hertz|enterprise rent|avis |budget rent|national car/i, category: "Travel" },

  // Insurance
  { pattern: /insurance|geico|state farm|allstate|progressive|farmers ins|liberty mutual|nationwide ins|usaa|travelers ins|hartford/i, category: "Insurance" },

  // Transfers & Payments
  { pattern: /transfer|zelle|venmo|paypal|cashapp|cash app|wire |ach |payment|bill pay|chase pay|apple pay|google pay/i, category: "Transfers & Payments" },
]

function ruleBasedCategorize(payee: string, amount: number): { category: string; confidence: number } | null {
  // Positive = likely income
  if (amount > 0) {
    for (const rule of RULES) {
      if (rule.pattern.test(payee)) return { category: rule.category, confidence: 0.85 }
    }
    return { category: "Income", confidence: 0.7 }
  }

  for (const rule of RULES) {
    if (rule.pattern.test(payee)) return { category: rule.category, confidence: 0.85 }
  }

  return null // no match — try Ollama
}

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

async function ollamaCategorize(
  payee: string,
  amount: number,
  memo?: string
): Promise<{ category: string; confidence: number }> {
  const baseUrl = process.env.OLLAMA_BASE_URL
  if (!baseUrl) return { category: "Miscellaneous", confidence: 0 }

  const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b"
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Payee: "${payee}"\nAmount: $${amount}\nMemo: ${memo ?? "none"}` },
        ],
        temperature: 0.1,
      }),
    })

    if (!res.ok) throw new Error(`Ollama ${res.status}`)
    const data = await res.json()
    const raw: string = data.choices?.[0]?.message?.content ?? ""
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(cleaned)
    const category = CATEGORIES.includes(parsed.category) ? parsed.category : "Miscellaneous"
    return { category, confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8 }
  } catch {
    return { category: "Miscellaneous", confidence: 0 }
  } finally {
    clearTimeout(timeout)
  }
}

async function userRulesCategorize(payee: string): Promise<{ category: string; confidence: number } | null> {
  const rules = await db.select()
    .from(categorization_rules)
    .where(sql`${categorization_rules.is_active} = true`)
    .orderBy(desc(categorization_rules.priority))

  for (const rule of rules) {
    if (payee.toLowerCase().includes(rule.payee_pattern.toLowerCase())) {
      return { category: rule.category, confidence: 1.0 }
    }
  }
  return null
}

export async function categorizeTransaction(
  payee: string,
  amount: number,
  memo?: string
): Promise<{ category: string; confidence: number }> {
  // 1. User-defined rules — highest priority
  const userRule = await userRulesCategorize(payee)
  if (userRule) return userRule

  // 2. Built-in keyword rules — instant, no network call
  const ruleResult = ruleBasedCategorize(payee, amount)
  if (ruleResult) return ruleResult

  // 3. Ollama fallback for unmatched transactions
  return ollamaCategorize(payee, amount, memo)
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
    // Only delay before Ollama calls — rule-based needs no throttle
    if (count < pending.length) await delay(50)
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
