import { Resend } from "resend"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { sql, desc } from "drizzle-orm"
import { getUpcomingBills } from "./bills"
import { postToDiscord, buildDailyEmbeds, buildWeeklyEmbeds } from "./discord-webhook"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function generateWeeklyInsights(spendingData: unknown): Promise<string> {
  try {
    const baseUrl = process.env.OLLAMA_BASE_URL
    const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b"
    const weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a concise personal finance advisor. Be specific, not generic.",
          },
          {
            role: "user",
            content: `Week of ${weekOf}. Spending: ${JSON.stringify(spendingData)}. Give 4–5 specific observations and savings opportunities as bullet points starting with an emoji.`,
          },
        ],
        temperature: 0.7,
      }),
    })

    if (!res.ok) throw new Error("Ollama request failed")
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? "No insights available this week."
  } catch {
    return "No insights available this week."
  }
}

function getDateRange(daysBack: number): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function sendDailyReport(): Promise<{ emailSent: boolean; discordPosted: boolean }> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [yesterdayTxns, mtdTotals, upcomingBills] = await Promise.all([
    db.select().from(transactions).where(
      sql`${transactions.posted} >= ${yesterday.toISOString()} and ${transactions.posted} < ${yesterdayEnd.toISOString()}`
    ).orderBy(desc(transactions.posted)),
    db.select({
      income: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) > 0 then cast(${transactions.amount} as numeric) else 0 end), 0)`,
      expenses: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) < 0 then abs(cast(${transactions.amount} as numeric)) else 0 end), 0)`,
    }).from(transactions).where(
      sql`${transactions.posted} >= ${monthStart.toISOString()}`
    ),
    getUpcomingBills(3),
  ])

  const totalSpent = yesterdayTxns.filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0)
  const totalIncome = yesterdayTxns.filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0)
  const dateStr = yesterday.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })

  const data = {
    date: dateStr,
    totalSpent,
    totalIncome,
    transactions: yesterdayTxns.map(t => ({ payee: t.payee, amount: parseFloat(t.amount), category: t.category })),
    mtdExpenses: parseFloat(mtdTotals[0].expenses),
    mtdIncome: parseFloat(mtdTotals[0].income),
    upcomingBills,
  }

  const html = buildDailyEmailHtml(data)
  const subject = `💰 Yesterday's Spending — ${dateStr}`

  const [emailResult, discordResult] = await Promise.all([
    resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: process.env.EMAIL_TO!,
      subject,
      html,
    }).then(() => true).catch(() => false),
    postToDiscord(process.env.DISCORD_DAILY_WEBHOOK ?? "", buildDailyEmbeds(data)),
  ])

  return { emailSent: emailResult as boolean, discordPosted: discordResult }
}

export async function sendWeeklyReport(): Promise<{ emailSent: boolean; discordPosted: boolean }> {
  const { start, end } = getDateRange(7)
  const now = new Date()
  const weekOf = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const [totals, categoryRows] = await Promise.all([
    db.select({
      totalIn: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) > 0 then cast(${transactions.amount} as numeric) else 0 end), 0)`,
      totalOut: sql<string>`coalesce(sum(case when cast(${transactions.amount} as numeric) < 0 then abs(cast(${transactions.amount} as numeric)) else 0 end), 0)`,
    }).from(transactions).where(
      sql`${transactions.posted} >= ${start.toISOString()} and ${transactions.posted} < ${end.toISOString()}`
    ),
    db.select({
      category: transactions.category,
      total: sql<string>`sum(abs(cast(${transactions.amount} as numeric)))`,
    }).from(transactions).where(
      sql`cast(${transactions.amount} as numeric) < 0 and ${transactions.posted} >= ${start.toISOString()} and ${transactions.posted} < ${end.toISOString()}`
    ).groupBy(transactions.category).orderBy(sql`sum(abs(cast(${transactions.amount} as numeric))) desc`).limit(5),
  ])

  const totalIn = parseFloat(totals[0].totalIn)
  const totalOut = parseFloat(totals[0].totalOut)
  const savingsRate = totalIn > 0 ? ((totalIn - totalOut) / totalIn) * 100 : 0

  const topCategories = categoryRows.map(r => ({ category: r.category, total: parseFloat(r.total) }))
  const insights = await generateWeeklyInsights({ weekOf, totalIn, totalOut, topCategories })

  const data = {
    weekOf,
    totalIn,
    totalOut,
    savingsRate,
    topCategories,
    unpaidBills: (await getUpcomingBills(7)),
  }

  const html = buildWeeklyEmailHtml(data, insights)
  const subject = `📊 Weekly Overview — Week of ${weekOf}`

  const [emailResult, discordResult] = await Promise.all([
    resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: process.env.EMAIL_TO!,
      subject,
      html,
    }).then(() => true).catch(() => false),
    postToDiscord(process.env.DISCORD_WEEKLY_WEBHOOK ?? "", buildWeeklyEmbeds(data, insights)),
  ])

  return { emailSent: emailResult as boolean, discordPosted: discordResult }
}

export function buildDailyEmailHtml(data: {
  date: string
  totalSpent: number
  totalIncome: number
  transactions: { payee: string; amount: number; category: string | null }[]
  mtdExpenses: number
  mtdIncome: number
  upcomingBills: { name: string; amount: string; due_day: number }[]
}): string {
  const net = data.totalIncome - data.totalSpent
  const txnRows = data.transactions.map(t => `
    <tr>
      <td style="padding:8px 12px;color:#94a3b8;">${t.payee}</td>
      <td style="padding:8px 12px;color:#94a3b8;">${t.category ?? "—"}</td>
      <td style="padding:8px 12px;text-align:right;color:${t.amount < 0 ? "#f43f5e" : "#10b981"};font-family:monospace;">
        ${t.amount < 0 ? "-" : "+"}$${Math.abs(t.amount).toFixed(2)}
      </td>
    </tr>`).join("")

  const billRows = data.upcomingBills.map(b => `
    <tr>
      <td style="padding:6px 12px;color:#94a3b8;">${b.name}</td>
      <td style="padding:6px 12px;color:#f59e0b;text-align:right;font-family:monospace;">$${parseFloat(b.amount).toFixed(2)}</td>
      <td style="padding:6px 12px;color:#94a3b8;text-align:right;">Day ${b.due_day}</td>
    </tr>`).join("")

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <h1 style="font-family:monospace;color:#10b981;margin:0 0 4px;">FinTrack</h1>
    <h2 style="color:#e2e8f0;margin:0 0 24px;font-size:18px;">💰 Yesterday's Spending — ${data.date}</h2>

    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;display:flex;gap:16px;">
      <div style="flex:1;text-align:center;">
        <div style="font-size:24px;font-family:monospace;color:#f43f5e;">$${data.totalSpent.toFixed(2)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Spent</div>
      </div>
      <div style="flex:1;text-align:center;">
        <div style="font-size:24px;font-family:monospace;color:#10b981;">$${data.totalIncome.toFixed(2)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Income</div>
      </div>
      <div style="flex:1;text-align:center;">
        <div style="font-size:24px;font-family:monospace;color:${net >= 0 ? "#10b981" : "#f43f5e"};">${net >= 0 ? "+" : ""}$${net.toFixed(2)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Net</div>
      </div>
    </div>

    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Transactions</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #334155;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Payee</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Category</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;">Amount</th>
          </tr>
        </thead>
        <tbody>${txnRows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#64748b;">No transactions</td></tr>'}</tbody>
      </table>
    </div>

    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Month-to-Date</h3>
      <div style="display:flex;gap:16px;">
        <div><span style="color:#10b981;font-family:monospace;font-size:18px;">$${data.mtdIncome.toFixed(2)}</span><div style="font-size:12px;color:#64748b;">Income</div></div>
        <div><span style="color:#f43f5e;font-family:monospace;font-size:18px;">$${data.mtdExpenses.toFixed(2)}</span><div style="font-size:12px;color:#64748b;">Expenses</div></div>
      </div>
    </div>

    ${data.upcomingBills.length > 0 ? `
    <div style="background:#1e293b;border:1px solid #f59e0b;border-radius:12px;padding:20px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#f59e0b;text-transform:uppercase;letter-spacing:0.05em;">⚠️ Upcoming Bills</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${billRows}</tbody>
      </table>
    </div>` : ""}
  </div>
</body>
</html>`
}

export function buildWeeklyEmailHtml(
  data: {
    weekOf: string
    totalIn: number
    totalOut: number
    savingsRate: number
    topCategories: { category: string | null; total: number }[]
    unpaidBills: { name: string; amount: string; due_day: number }[]
  },
  insights: string
): string {
  const net = data.totalIn - data.totalOut
  const catRows = data.topCategories.map((c, i) => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155;">
      <span style="color:#94a3b8;">${i + 1}. ${c.category ?? "Uncategorized"}</span>
      <span style="font-family:monospace;color:#f43f5e;">$${c.total.toFixed(2)}</span>
    </div>`).join("")

  const insightLines = insights.split("\n").filter(Boolean).map(l => `<p style="margin:4px 0;color:#94a3b8;">${l}</p>`).join("")

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <h1 style="font-family:monospace;color:#10b981;margin:0 0 4px;">FinTrack</h1>
    <h2 style="color:#e2e8f0;margin:0 0 24px;font-size:18px;">📊 Weekly Overview — Week of ${data.weekOf}</h2>

    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="display:flex;gap:16px;text-align:center;">
        <div style="flex:1;"><div style="font-size:22px;font-family:monospace;color:#10b981;">$${data.totalIn.toFixed(2)}</div><div style="font-size:12px;color:#64748b;">In</div></div>
        <div style="flex:1;"><div style="font-size:22px;font-family:monospace;color:#f43f5e;">$${data.totalOut.toFixed(2)}</div><div style="font-size:12px;color:#64748b;">Out</div></div>
        <div style="flex:1;"><div style="font-size:22px;font-family:monospace;color:${net >= 0 ? "#10b981" : "#f43f5e"};">${net >= 0 ? "+" : ""}$${net.toFixed(2)}</div><div style="font-size:12px;color:#64748b;">Net</div></div>
        <div style="flex:1;"><div style="font-size:22px;font-family:monospace;color:#6366f1;">${data.savingsRate.toFixed(1)}%</div><div style="font-size:12px;color:#64748b;">Saved</div></div>
      </div>
    </div>

    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Top Categories</h3>
      ${catRows}
    </div>

    <div style="background:#1e293b;border-left:3px solid #6366f1;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#6366f1;text-transform:uppercase;letter-spacing:0.05em;">💡 AI Insights</h3>
      ${insightLines}
    </div>

    ${data.unpaidBills.length > 0 ? `
    <div style="background:#1e293b;border:1px solid #f59e0b;border-radius:12px;padding:20px;">
      <h3 style="margin:0 0 8px;font-size:14px;color:#f59e0b;">📋 Unpaid Bills This Week</h3>
      ${data.unpaidBills.map(b => `<div style="padding:4px 0;color:#94a3b8;">${b.name} — <span style="color:#f59e0b;font-family:monospace;">$${parseFloat(b.amount).toFixed(2)}</span> due day ${b.due_day}</div>`).join("")}
    </div>` : ""}
  </div>
</body>
</html>`
}
