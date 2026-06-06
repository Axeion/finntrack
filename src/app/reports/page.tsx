"use client"

import { useEffect, useState, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts"
import Header from "@/components/Header"
import CategoryPill, { getCategoryColor } from "@/components/CategoryPill"

interface ReportData {
  categoryTotals: { category: string | null; total: number; count: number }[]
  monthlyTotals: { month: string; income: number; expenses: number; net: number }[]
  topPayees: { payee: string; total: number; count: number; category: string | null }[]
  categoryMonthly: { month: string; category: string | null; total: number }[]
  dateRange: { start: string; end: string }
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"]

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  function exportCsv() {
    if (!data) return
    const rows = [
      ["Category", "Total Spent", "# Transactions"],
      ...data.categoryTotals.map((r) => [r.category ?? "Uncategorized", r.total.toFixed(2), r.count]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "spending-report.csv"
    a.click()
  }

  const totalSpent = data?.categoryTotals.reduce((s, r) => s + r.total, 0) ?? 0

  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-white">Spending Reports</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500" />
            <button onClick={exportCsv}
              className="px-3 py-1.5 rounded-md text-sm text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-slate-400">Loading...</div>
          </div>
        ) : !data ? null : (
          <>
            {/* Monthly Income vs Expenses trend */}
            <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">Monthly Income vs Expenses</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthlyTotals} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name]}
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Net by month */}
            <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">Net Savings by Month</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.monthlyTotals} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v) => [`$${Number(v).toFixed(2)}`, "Net"]}
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Bar dataKey="net" name="Net" radius={[3, 3, 0, 0]}>
                    {data.monthlyTotals.map((entry, i) => (
                      <Cell key={i} fill={entry.net >= 0 ? "#10b981" : "#f43f5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category breakdown */}
              <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Spending by Category <span className="text-slate-500 font-normal normal-case ml-2">${totalSpent.toFixed(2)} total</span>
                </h2>
                <div className="space-y-2">
                  {data.categoryTotals.map((row) => (
                    <div key={row.category}>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span className="flex items-center gap-2">
                          <CategoryPill category={row.category} />
                          <span className="text-slate-500">{row.count} txns</span>
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", color: getCategoryColor(row.category) }}>
                          ${row.total.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${(row.total / totalSpent) * 100}%`, backgroundColor: getCategoryColor(row.category) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top payees */}
              <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">Top Merchants</h2>
                <div className="space-y-2">
                  {data.topPayees.slice(0, 12).map((row, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-slate-600 w-4 shrink-0">{i + 1}</span>
                        <span className="text-sm text-slate-300 truncate">{row.payee}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <CategoryPill category={row.category} />
                        <span style={{ fontFamily: "var(--font-mono)", color: "#e2e8f0", fontSize: 13 }}>
                          ${row.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
