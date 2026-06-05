"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Header from "@/components/Header"
import CategoryPill from "@/components/CategoryPill"
import { CATEGORIES } from "@/lib/constants"

interface Transaction {
  id: string
  payee: string
  memo: string | null
  amount: string
  category: string | null
  posted: string
}

interface ApiResponse {
  transactions: Transaction[]
  total: number
  page: number
  totalPages: number
}

function TransactionsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const page = parseInt(searchParams.get("page") ?? "1")
  const category = searchParams.get("category") ?? ""
  const startDate = searchParams.get("startDate") ?? ""
  const endDate = searchParams.get("endDate") ?? ""
  const search = searchParams.get("search") ?? ""

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "50")
    if (category) params.set("category", category)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    if (search) params.set("search", search)

    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page, category, startDate, endDate, search])

  useEffect(() => { fetchData() }, [fetchData])

  function updateParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (val) p.set(key, val); else p.delete(key)
    p.delete("page")
    router.push(`/transactions?${p}`)
  }

  function handleSearchInput(val: string) {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => updateParam("search", val), 300)
  }

  async function handleRecategorize(id: string, newCategory: string) {
    setEditingId(id)
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory }),
    })
    setData((prev) => prev ? {
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === id ? { ...t, category: newCategory } : t
      ),
    } : null)
    setEditingId(null)
  }

  function exportCsv() {
    if (!data) return
    const rows = [
      ["Date", "Payee", "Memo", "Category", "Amount"],
      ...data.transactions.map((t) => [
        new Date(t.posted).toLocaleDateString(),
        t.payee,
        t.memo ?? "",
        t.category ?? "",
        t.amount,
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "transactions.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const income = data?.transactions.filter((t) => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0) ?? 0
  const expenses = data?.transactions.filter((t) => parseFloat(t.amount) < 0).reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0) ?? 0

  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header />

      {/* Filter Bar */}
      <div className="sticky top-14 z-40 border-b border-slate-800" style={{ backgroundColor: "#0f172a" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-3 items-center">
          <input
            type="date"
            defaultValue={startDate}
            onChange={(e) => updateParam("startDate", e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="date"
            defaultValue={endDate}
            onChange={(e) => updateParam("endDate", e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500"
          />
          <select
            defaultValue={category}
            onChange={(e) => updateParam("category", e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            defaultValue={search}
            placeholder="Search payee..."
            onChange={(e) => handleSearchInput(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500 w-48"
          />
          <button
            onClick={exportCsv}
            className="ml-auto px-3 py-1.5 rounded-md text-sm text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Bar */}
        {data && (
          <div className="flex gap-6 text-sm mb-4 text-slate-400">
            <span>{data.total} transactions</span>
            <span style={{ color: "#10b981" }}>In: ${income.toFixed(2)}</span>
            <span style={{ color: "#f43f5e" }}>Out: ${expenses.toFixed(2)}</span>
            <span style={{ color: income - expenses >= 0 ? "#10b981" : "#f43f5e" }}>
              Net: {income - expenses >= 0 ? "+" : ""}${(income - expenses).toFixed(2)}
            </span>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#1e293b" }}>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : !data || data.transactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-slate-400">No transactions match your filters</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["Date", "Payee", "Memo", "Category", "Amount", "Edit"].map((h, i) => (
                      <th key={h}
                        className={`px-5 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide ${i >= 4 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((txn, i) => {
                    const amount = parseFloat(txn.amount)
                    return (
                      <tr key={txn.id} className="border-b border-slate-700/50 last:border-0"
                        style={{ backgroundColor: i % 2 === 1 ? "#162032" : undefined }}>
                        <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(txn.posted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                        </td>
                        <td className="px-5 py-3 text-slate-200 max-w-[200px] truncate">{txn.payee}</td>
                        <td className="px-5 py-3 text-slate-400 max-w-[180px] truncate text-xs">{txn.memo ?? "—"}</td>
                        <td className="px-5 py-3"><CategoryPill category={txn.category} /></td>
                        <td className="px-5 py-3 text-right whitespace-nowrap"
                          style={{ fontFamily: "var(--font-mono)", color: amount < 0 ? "#f43f5e" : "#10b981" }}>
                          {amount < 0 ? "-" : "+"}${Math.abs(amount).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <select
                            value={txn.category ?? ""}
                            disabled={editingId === txn.id}
                            onChange={(e) => handleRecategorize(txn.id, e.target.value)}
                            className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 border border-slate-600 focus:outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="">— edit —</option>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
            <button
              disabled={page <= 1}
              onClick={() => updateParam("page", String(page - 1))}
              className="px-4 py-2 rounded-md border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              ← Previous
            </button>
            <span>Page {page} of {data.totalPages}</span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => updateParam("page", String(page + 1))}
              className="px-4 py-2 rounded-md border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  )
}
