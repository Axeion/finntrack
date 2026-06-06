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
    <div className="rounded-xl p-4 flex flex-col gap-1.5" style={{ backgroundColor: "#1e293b" }}>
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div
        className="text-xl font-bold truncate"
        style={{
          fontFamily: "var(--font-mono)",
          color: positive === undefined ? "#e2e8f0" : positive ? "#10b981" : "#f43f5e",
        }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function Skeleton({ h = "h-6" }: { h?: string }) {
  return <div className={`${h} w-full rounded animate-pulse bg-slate-700`} />
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string>("")

  function loadData(accountId?: string) {
    setLoading(true)
    setError(null)
    const params = accountId ? `?accountId=${accountId}` : ""
    fetch(`/api/dashboard${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { loadData() }, [])

  function handleAccountChange(id: string) {
    setSelectedAccount(id)
    loadData(id || undefined)
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} h="h-24" />)}
          </div>
          <Skeleton h="h-64" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Skeleton h="h-48" />
            <Skeleton h="h-48" />
          </div>
          <Skeleton h="h-64" />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-slate-300 text-lg mb-2">Failed to load dashboard</div>
          <div className="text-slate-500 text-sm mb-6" style={{ fontFamily: "var(--font-mono)" }}>{error}</div>
          <button onClick={() => loadData(selectedAccount || undefined)} className="px-4 py-2 rounded-lg text-sm text-white cursor-pointer" style={{ backgroundColor: "#10b981" }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null
  const netMonth = data.monthlyIncome - data.monthlyExpenses
  const selectedAccountName = selectedAccount
    ? data.accounts.find((a) => a.id === selectedAccount)?.name ?? "Account"
    : null

  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header lastSync={data.lastSync} onSyncComplete={() => loadData(selectedAccount || undefined)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        {/* Account selector */}
        {data.accounts.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 uppercase tracking-wide shrink-0">Account</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAccountChange("")}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: !selectedAccount ? "#10b981" : "#1e293b",
                  color: !selectedAccount ? "#fff" : "#94a3b8",
                }}
              >
                All
              </button>
              {data.accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAccountChange(a.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: selectedAccount === a.id ? "#10b981" : "#1e293b",
                    color: selectedAccount === a.id ? "#fff" : "#94a3b8",
                  }}
                >
                  {a.name}
                  <span className="ml-1.5 opacity-70" style={{ fontFamily: "var(--font-mono)" }}>
                    ${parseFloat(a.balance).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            label={selectedAccountName ? `${selectedAccountName} Balance` : "Total Balance"}
            value={`$${data.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          />
        </div>

        {/* Category Bar Chart */}
        {data.categoryTotals.length > 0 && (
          <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Spending This Month
            </h2>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 300 }}>
                <ResponsiveContainer width="100%" height={Math.max(180, data.categoryTotals.length * 34)}>
                  <BarChart data={data.categoryTotals} layout="vertical" margin={{ left: 0, right: 52, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category" dataKey="category" width={130}
                      tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false}
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
            </div>
          </div>
        )}

        {/* Cash Flow + Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">Cash Flow</h2>
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
                  <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                  </div>
                </div>
              ))}
            </div>
            {data.cashFlow.upcomingUnpaid.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Unpaid Bills</div>
                {data.cashFlow.upcomingUnpaid.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex justify-between text-sm gap-2">
                    <span className="text-slate-300 truncate">{b.name}</span>
                    <div className="flex gap-3 items-center shrink-0">
                      <span className="text-xs text-slate-500">Day {b.due_day}</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "#f59e0b" }}>
                        ${parseFloat(b.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl p-4 sm:p-6" style={{ backgroundColor: "#1e293b" }}>
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-4">30-Day Spending</h2>
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
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-700">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Recent Transactions</h2>
            <Link
              href={selectedAccount ? `/transactions?accountId=${selectedAccount}` : "/transactions"}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 360 }}>
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 sm:px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Date</th>
                  <th className="px-4 sm:px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Payee</th>
                  <th className="hidden sm:table-cell px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Category</th>
                  <th className="px-4 sm:px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-right">Amount</th>
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
                        <td className="px-4 sm:px-6 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(txn.posted).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-slate-200 max-w-[140px] sm:max-w-xs truncate">{txn.payee}</td>
                        <td className="hidden sm:table-cell px-6 py-3"><CategoryPill category={txn.category} /></td>
                        <td className="px-4 sm:px-6 py-3 text-right whitespace-nowrap"
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
