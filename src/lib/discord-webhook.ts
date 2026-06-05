interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
}

export async function postToDiscord(webhookUrl: string, embeds: DiscordEmbed[]): Promise<boolean> {
  if (!webhookUrl) return false
  try {
    const chunks: DiscordEmbed[][] = []
    for (let i = 0; i < embeds.length; i += 10) {
      chunks.push(embeds.slice(i, i + 10))
    }
    for (const chunk of chunks) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: chunk }),
      })
      if (!res.ok) return false
    }
    return true
  } catch {
    return false
  }
}

interface DailyData {
  date: string
  totalSpent: number
  totalIncome: number
  transactions: { payee: string; amount: number; category: string | null }[]
  mtdExpenses: number
  mtdIncome: number
  upcomingBills: { name: string; amount: string; due_day: number }[]
}

export function buildDailyEmbeds(data: DailyData): DiscordEmbed[] {
  const net = data.totalIncome - data.totalSpent
  const color = net >= 0 ? 0x10b981 : 0xf43f5e

  const txnLines = data.transactions
    .slice(0, 10)
    .map((t) => `${t.amount < 0 ? "🔴" : "🟢"} **${t.payee}** — $${Math.abs(t.amount).toFixed(2)}`)
    .join("\n")

  const overflow = data.transactions.length > 10 ? `\n_...and ${data.transactions.length - 10} more_` : ""

  const embeds: DiscordEmbed[] = [
    {
      title: `💰 Daily Spending — ${data.date}`,
      color,
      fields: [
        { name: "Total Spent", value: `$${data.totalSpent.toFixed(2)}`, inline: true },
        { name: "Total Income", value: `$${data.totalIncome.toFixed(2)}`, inline: true },
        { name: "Net", value: `${net >= 0 ? "+" : ""}$${net.toFixed(2)}`, inline: true },
        { name: "Month-to-Date", value: `In: $${data.mtdIncome.toFixed(2)} | Out: $${data.mtdExpenses.toFixed(2)}`, inline: false },
        { name: "Transactions", value: txnLines + overflow || "_No transactions_", inline: false },
      ],
    },
  ]

  if (data.upcomingBills.length > 0) {
    embeds.push({
      title: "⚠️ Upcoming Bills",
      color: 0xf59e0b,
      fields: data.upcomingBills.map((b) => ({
        name: b.name,
        value: `$${parseFloat(b.amount).toFixed(2)} — due day ${b.due_day}`,
        inline: true,
      })),
    })
  }

  return embeds
}

interface WeeklyData {
  weekOf: string
  totalIn: number
  totalOut: number
  savingsRate: number
  topCategories: { category: string | null; total: number }[]
  unpaidBills: { name: string; amount: string; due_day: number }[]
}

export function buildWeeklyEmbeds(data: WeeklyData, aiInsights: string): DiscordEmbed[] {
  const net = data.totalIn - data.totalOut
  const embeds: DiscordEmbed[] = [
    {
      title: `📊 Weekly Overview — Week of ${data.weekOf}`,
      color: 0x6366f1,
      fields: [
        { name: "Total In", value: `$${data.totalIn.toFixed(2)}`, inline: true },
        { name: "Total Out", value: `$${data.totalOut.toFixed(2)}`, inline: true },
        { name: "Net", value: `${net >= 0 ? "+" : ""}$${net.toFixed(2)}`, inline: true },
        { name: "Savings Rate", value: `${data.savingsRate.toFixed(1)}%`, inline: true },
        ...data.topCategories.slice(0, 5).map((c) => ({
          name: c.category ?? "Uncategorized",
          value: `$${c.total.toFixed(2)}`,
          inline: true,
        })),
      ],
    },
    {
      title: "💡 Smart Insights",
      color: 0x6366f1,
      description: aiInsights,
    },
  ]

  if (data.unpaidBills.length > 0) {
    embeds.push({
      title: "📋 Bills Status",
      color: 0xf59e0b,
      fields: data.unpaidBills.map((b) => ({
        name: b.name,
        value: `$${parseFloat(b.amount).toFixed(2)} — due day ${b.due_day}`,
        inline: true,
      })),
    })
  }

  return embeds
}
