"use client"

import { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area,
} from "recharts"
import Header from "@/components/Header"
import CategoryPill, { getCategoryColor } from "@/components/CategoryPill"
import Link from "next/link"

interface DashboardData {
  accounts: { id: string; name: string; org: string; balance: string }[]
  monthlyIncome: number
  monthlyExpenses: number
  priorMonthIncome: number
  priorMonthExpenses: number
  totalBalance: number
  categoryTotals: { category: string | null; total: number }[]
  dailyTotals: { date: string; income: number; expenses: number }[]
  recentTransactions: {
    id: string; payee: string; amount: string; category: string | null; posted: string
  }[]
  cashFlow: {
    income: number; totalBills: number; discretionary: number; billsPercent: number
    upcomingUnpaid: { id: number; name: string; amount: string; due_day: number }[]
  }
  billStatus: { bill: { name: string; amount: string }; status: string }[]
  lastSync: string | null
}

function pctChange(current: number, prior: number): string {
  if (prior === 0) return "—"
  const pct = ((current - prior) / prior) * 100
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
}

function KpiCard({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean
}) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-2" style={{ backgroundColor: "#1e293b" }}>
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div
        className="text-2xl font-bold"
        style={{
          fontFamily: "var(--font-mono)",
          color: positive === undefined ? "#e2e8f0" : positive ? "#10b981" : "#f43f5e",
        }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function Skeleton({ h = "h-6", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded animate-pulse bg-slate-700`} />
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  function loadData() {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  if (loading) {
    return (
      <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} h="h-28" />)}
          </div>
          <Skeleton h="h-64" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Skeleton h="h-48" w="lg:col-span-3" />
            <Skeleton h="h-48" w="lg:col-span-2" />
          </div>
          <Skeleton h="h-64" />
        </main>
      </div>
    )
  }

  if (!data) return null
  const netMonth = data.monthlyIncome - data.monthlyExpenses

  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header lastSync={data.lastSync} onSyncComplete={loadData} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Monthly Income"
            value={`$${data.monthlyIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            sub={`${pctChange(data.monthlyIncome, data.priorMonthIncome)} vs last month`}
            positive={true}
          />
          <KpiCard
            label="Monthly Expenses"
            value={`$${data.monthlyExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            sub={`${pctChange(data.monthlyExpenses, data.priorMonthExpenses)} vs last month`}
            positive={false}
          />
          <KpiCard
            label="Net This Month"
            value={`${netMonth >= 0 ? "+" : ""}$${Math.abs(netMonth).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            positive={netMonth >= 0}
          />
          <KpiCard
            label="Total Balance"
            value={`$${data.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          />
        </div>

        {/* Category Bar Chart */}
        {data.categoryTotals.length > 0 && (
          <div className="rounded-xl p-6" style={{ backgroundColor: "#1e293b" }}>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Spending This Month
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.categoryTotals} layout="vertical" margin={{ left: 8, right: 48, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category" dataKey="category" width={160}
                  tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Spent"]}
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                  cursor={{ fill: "#334155" }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}
                  label={{ position: "right", fill: "#64748b", fontSize: 11, formatter: (v: unknown) => `$${Number(v).toFixed(0)}` }}>
                  {data.categoryTotals.map((entry, i) => (
                    <Cell key={i} fill={getCategoryColor(entry.category)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cash Flow + Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-xl p-6" style={{ backgroundColor: "#1e293b" }}>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Cash Flow</h2>
            <div className="space-y-3 mb-4">
              {[
                { label: "Income", pct: 100, val: data.cashFlow.income, color: "#10b981" },
                { label: `Bills (${data.cashFlow.billsPercent.toFixed(0)}%)`, pct: Math.min(100, data.cashFlow.billsPercent), val: data.cashFlow.totalBills, color: "#f59e0b" },
                {
                  label: "Discretionary",
                  pct: Math.min(100, Math.max(0, 100 - data.cashFlow.billsPercent)),
                  val: data.cashFlow.discretionary,
                  color: data.cashFlow.discretionary >= 0 ? "#10b981" : "#f43f5e",
                },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{row.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: row.color }}>
                      ${row.val.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                  </div>
                </div>
              ))}
            </div>
            {data.cashFlow.upcomingUnpaid.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Unpaid Bills</div>
                {data.cashFlow.upcomingUnpaid.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex justify-between text-sm">
                    <span className="text-slate-300">{b.name}</span>
                    <div className="flex gap-3 items-center">
                      <span className="text-xs text-slate-500">Due day {b.due_day}</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "#f59e0b" }}>
                        ${parseFloat(b.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl p-6" style={{ backgroundColor: "#1e293b" }}>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">30-Day Spending</h2>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data.dailyTotals} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="expenses" stroke="#10b981" strokeWidth={2} fill="url(#expGrad)" dot={false} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Spent"]}
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#64748b", fontSize: 11 }}
                  cursor={{ stroke: "#334155" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-xl" style={{ backgroundColor: "#1e293b" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Recent Transactions</h2>
            <Link href="/transactions" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Date", "Payee", "Category", "Amount"].map((h, i) => (
                    <th key={h} className={`px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No transactions yet</td></tr>
                ) : (
                  data.recentTransactions.map((txn, i) => {
                    const amount = parseFloat(txn.amount)
                    return (
                      <tr key={txn.id} className="border-b border-slate-700/50 last:border-0"
                        style={{ backgroundColor: i % 2 === 1 ? "#162032" : undefined }}>
                        <td className="px-6 py-3 text-slate-400 text-xs">
                          {new Date(txn.posted).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-6 py-3 text-slate-200">{txn.payee}</td>
                        <td className="px-6 py-3"><CategoryPill category={txn.category} /></td>
                        <td className="px-6 py-3 text-right"
                          style={{ fontFamily: "var(--font-mono)", color: amount < 0 ? "#f43f5e" : "#10b981" }}>
                          {amount < 0 ? "-" : "+"}${Math.abs(amount).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
