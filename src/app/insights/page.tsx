"use client"

import { useEffect, useState } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import Header from "@/components/Header"
import CategoryPill from "@/components/CategoryPill"
import { CATEGORIES } from "@/lib/constants"

interface Target {
  id: number
  category: string
  monthly_limit: number
  spent: number
  pct: number
}

interface RecurringItem {
  payee: string
  period: string
  amount: number
  count: number
  lastSeen: string
  category: string | null
}

interface NetWorthData {
  history: { month: string; total: number }[]
  current: number
  accounts: { id: string; name: string; balance: number }[]
}

const PERIOD_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
}

export default function InsightsPage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [recurring, setRecurring] = useState<RecurringItem[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null)
  const [loading, setLoading] = useState(true)

  const [newCategory, setNewCategory] = useState(CATEGORIES[1])
  const [newLimit, setNewLimit] = useState("")
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    const [t, r, n] = await Promise.all([
      fetch("/api/targets").then((res) => res.json()),
      fetch("/api/recurring").then((res) => res.json()),
      fetch("/api/networth").then((res) => res.json()),
    ])
    setTargets(t)
    setRecurring(r)
    setNetWorth(n)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function addTarget(e: React.FormEvent) {
    e.preventDefault()
    if (!newLimit) return
    setSaving(true)
    await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory, monthly_limit: parseFloat(newLimit) }),
    })
    setNewLimit("")
    const res = await fetch("/api/targets")
    setTargets(await res.json())
    setSaving(false)
  }

  async function removeTarget(id: number) {
    await fetch(`/api/targets/${id}`, { method: "DELETE" })
    setTargets((prev) => prev.filter((t) => t.id !== id))
  }

  const monthlyRecurringTotal = recurring
    .filter((r) => r.period === "monthly")
    .reduce((s, r) => s + r.amount, 0)

  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <h1 className="text-lg font-semibold text-white">Insights</h1>

        {loading ? (
          <div className="py-24 text-center text-slate-400">Loading...</div>
        ) : (
          <>
            {/* Net Worth */}
            {netWorth && (
              <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
                <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Net Worth</h2>
                    <div className="text-2xl font-bold mt-1" style={{ fontFamily: "var(--font-mono)", color: "#10b981" }}>
                      ${netWorth.current.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {netWorth.accounts.map((a) => (
                      <div key={a.id} className="text-right">
                        <div className="text-xs text-slate-500">{a.name}</div>
                        <div className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)", color: a.balance >= 0 ? "#e2e8f0" : "#f43f5e" }}>
                          ${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {netWorth.history.length > 1 && (
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={netWorth.history} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v) => [`$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Net Worth"]}
                        contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                        labelStyle={{ color: "#64748b", fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#nwGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {netWorth.history.length <= 1 && (
                  <p className="text-xs text-slate-500 mt-2">Net worth history builds automatically on the 1st of each month.</p>
                )}
              </div>
            )}

            {/* Spending Targets */}
            <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">Monthly Spending Targets</h2>

              {targets.length > 0 && (
                <div className="space-y-3 mb-6">
                  {targets.map((t) => {
                    const over = t.pct > 100
                    const warning = t.pct > 80 && !over
                    const color = over ? "#f43f5e" : warning ? "#f59e0b" : "#10b981"
                    return (
                      <div key={t.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <CategoryPill category={t.category} />
                            {over && <span style={{ color: "#f43f5e" }}>Over budget!</span>}
                            {warning && <span style={{ color: "#f59e0b" }}>Getting close</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span style={{ fontFamily: "var(--font-mono)", color }}>
                              ${t.spent.toFixed(2)} / ${t.monthly_limit.toFixed(2)}
                            </span>
                            <button onClick={() => removeTarget(t.id)} className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer">×</button>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, t.pct)}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <form onSubmit={addTarget} className="flex flex-wrap gap-3 items-end border-t border-slate-700 pt-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                    className="px-3 py-2 rounded-md text-sm bg-slate-700 text-slate-200 border border-slate-600 focus:outline-none focus:border-emerald-500 cursor-pointer">
                    {CATEGORIES.filter((c) => c !== "Income").map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monthly Limit ($)</label>
                  <input type="number" min="1" step="any" value={newLimit} onChange={(e) => setNewLimit(e.target.value)}
                    placeholder="e.g. 500"
                    className="px-3 py-2 rounded-md text-sm bg-slate-700 text-slate-200 border border-slate-600 focus:outline-none focus:border-emerald-500 w-32" />
                </div>
                <button type="submit" disabled={saving || !newLimit}
                  className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: "#10b981" }}>
                  {saving ? "Saving…" : "Set Target"}
                </button>
              </form>
            </div>

            {/* Recurring transactions */}
            <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Recurring Transactions</h2>
                {monthlyRecurringTotal > 0 && (
                  <span className="text-xs text-slate-400">
                    Monthly recurring: <span style={{ fontFamily: "var(--font-mono)", color: "#f59e0b" }}>${monthlyRecurringTotal.toFixed(2)}</span>
                  </span>
                )}
              </div>
              {recurring.length === 0 ? (
                <p className="text-sm text-slate-500">No recurring transactions detected yet. Needs at least 2 months of transaction history.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 360 }}>
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="py-3 pr-4 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Payee</th>
                        <th className="py-3 pr-4 text-xs text-slate-400 font-medium uppercase tracking-wide text-left hidden sm:table-cell">Category</th>
                        <th className="py-3 pr-4 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Frequency</th>
                        <th className="py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurring.map((r, i) => (
                        <tr key={i} className="border-b border-slate-700/50 last:border-0"
                          style={{ backgroundColor: i % 2 === 1 ? "#162032" : undefined }}>
                          <td className="py-3 pr-4 text-slate-200 max-w-[160px] truncate">{r.payee}</td>
                          <td className="py-3 pr-4 hidden sm:table-cell"><CategoryPill category={r.category} /></td>
                          <td className="py-3 pr-4 text-xs text-slate-400">{PERIOD_LABEL[r.period] ?? r.period}</td>
                          <td className="py-3 text-right whitespace-nowrap" style={{ fontFamily: "var(--font-mono)", color: "#f43f5e" }}>
                            ${r.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
