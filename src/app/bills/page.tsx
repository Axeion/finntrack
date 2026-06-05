"use client"

import { useEffect, useState } from "react"
import Header from "@/components/Header"
import { CATEGORIES } from "@/lib/constants"

interface Bill {
  id: number
  name: string
  amount: string
  due_day: number
  category: string
  is_variable: boolean | null
  is_active: boolean | null
  payee_match: string | null
  notes: string | null
}

interface BillStatusEntry {
  bill: Bill
  payment: { paid_amount: string; paid_date: string } | null
  status: "paid" | "due_soon" | "overdue" | "upcoming"
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: "Paid", color: "#10b981", bg: "#10b98120" },
  due_soon: { label: "Due Soon", color: "#f59e0b", bg: "#f59e0b20" },
  overdue: { label: "Overdue", color: "#f43f5e", bg: "#f43f5e20" },
  upcoming: { label: "Upcoming", color: "#64748b", bg: "#64748b20" },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.upcoming
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}66` }}>
      {s.label}
    </span>
  )
}

const EMPTY_BILL = {
  name: "", amount: "", due_day: 1, category: "Miscellaneous",
  is_variable: false, payee_match: "", notes: "",
}

export default function BillsPage() {
  const [billStatuses, setBillStatuses] = useState<BillStatusEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_BILL)
  const [saving, setSaving] = useState(false)

  async function fetchBills() {
    const res = await fetch("/api/bills")
    const data = await res.json()
    setBillStatuses(data)
    setLoading(false)
  }

  useEffect(() => { fetchBills() }, [])

  function startEdit(bill: Bill) {
    setEditingBill(bill)
    setForm({
      name: bill.name,
      amount: bill.amount,
      due_day: bill.due_day,
      category: bill.category,
      is_variable: bill.is_variable ?? false,
      payee_match: bill.payee_match ?? "",
      notes: bill.notes ?? "",
    })
    setShowForm(true)
  }

  function resetForm() {
    setShowForm(false)
    setEditingBill(null)
    setForm(EMPTY_BILL)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, amount: form.amount, due_day: Number(form.due_day) }

    if (editingBill) {
      await fetch(`/api/bills/${editingBill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    }

    await fetchBills()
    resetForm()
    setSaving(false)
  }

  async function handleDeactivate(id: number) {
    await fetch(`/api/bills/${id}`, { method: "DELETE" })
    await fetchBills()
    setConfirmDeactivate(null)
  }

  const now = new Date()
  const activeBills = billStatuses.map((b) => b.bill)
  const totalBills = activeBills.reduce((s, b) => s + parseFloat(b.amount), 0)
  const annualTotal = totalBills * 12

  // 3-month outlook
  const months = [0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return d.toLocaleString("en-US", { month: "short", year: "2-digit" })
  })

  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Section 1: Cash Flow Summary */}
        <div className="rounded-xl p-6" style={{ backgroundColor: "#1e293b" }}>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Cash Flow</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Committed Bills", value: `$${totalBills.toFixed(2)}`, color: "#f59e0b" },
              { label: "Annual Total", value: `$${annualTotal.toFixed(2)}`, color: "#6366f1" },
              { label: "Active Bills", value: String(activeBills.length), color: "#94a3b8" },
            ].map((card) => (
              <div key={card.label} className="rounded-lg p-4" style={{ backgroundColor: "#0f172a" }}>
                <div className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)", color: card.color }}>
                  {card.value}
                </div>
                <div className="text-xs text-slate-400 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: This Month's Bills */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#1e293b" }}>
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">This Month's Bills</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : billStatuses.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No bills yet. Add your first bill below.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["Bill", "Expected", "Due Day", "Status", "Paid Date", "Actual", "Variance"].map((h) => (
                      <th key={h} className="px-5 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {billStatuses.map(({ bill, payment, status }, i) => {
                    const expected = parseFloat(bill.amount)
                    const actual = payment ? parseFloat(payment.paid_amount) : null
                    const variance = actual !== null ? actual - expected : null
                    return (
                      <tr key={bill.id} className="border-b border-slate-700/50 last:border-0"
                        style={{ backgroundColor: i % 2 === 1 ? "#162032" : undefined }}>
                        <td className="px-5 py-3 text-slate-200 font-medium">
                          {bill.name}
                          {bill.is_variable && <span className="ml-1 text-xs text-slate-500">~</span>}
                        </td>
                        <td className="px-5 py-3 text-slate-300" style={{ fontFamily: "var(--font-mono)" }}>
                          {bill.is_variable ? "~" : ""}${expected.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-slate-400">{bill.due_day}</td>
                        <td className="px-5 py-3"><StatusPill status={status} /></td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {payment ? new Date(payment.paid_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-3" style={{ fontFamily: "var(--font-mono)", color: "#e2e8f0" }}>
                          {actual !== null ? `$${actual.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-5 py-3" style={{
                          fontFamily: "var(--font-mono)",
                          color: variance === null ? "#64748b" : variance > 0 ? "#f43f5e" : "#10b981",
                        }}>
                          {variance === null ? "—" : `${variance > 0 ? "+" : ""}$${variance.toFixed(2)}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Manage Bills */}
        <div className="rounded-xl p-6" style={{ backgroundColor: "#1e293b" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Manage Bills</h2>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "#10b981" }}
              >
                + Add Bill
              </button>
            )}
          </div>

          {/* Inline Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-lg p-4 mb-6 space-y-4 border border-slate-700"
              style={{ backgroundColor: "#0f172a" }}>
              <h3 className="text-sm font-semibold text-slate-200">{editingBill ? "Edit Bill" : "New Bill"}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Name</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Expected Amount</label>
                  <input required type="number" step="0.01" min="0" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Due Day (1–28)</label>
                  <input required type="number" min="1" max="28" value={form.due_day}
                    onChange={(e) => setForm({ ...form, due_day: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Payee Match String</label>
                  <input value={form.payee_match} onChange={(e) => setForm({ ...form, payee_match: e.target.value })}
                    placeholder="e.g. NETFLIX"
                    className="w-full px-3 py-2 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500" />
                  <p className="text-xs text-slate-500 mt-1">Substring matched against transaction payee for auto-detection</p>
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={form.is_variable}
                      onChange={(e) => setForm({ ...form, is_variable: e.target.checked })}
                      className="rounded" />
                    Variable Amount
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: "#10b981" }}>
                  {saving ? "Saving..." : editingBill ? "Save Changes" : "Add Bill"}
                </button>
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Bills Cards */}
          <div className="space-y-3">
            {billStatuses.map(({ bill }) => (
              <div key={bill.id} className="flex items-center justify-between rounded-lg px-4 py-3 border border-slate-700"
                style={{ backgroundColor: "#0f172a" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">{bill.name}</span>
                    {bill.is_variable && <span className="text-xs text-slate-500">variable</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ${parseFloat(bill.amount).toFixed(2)} · Due day {bill.due_day} · {bill.category}
                    {bill.payee_match && ` · match: "${bill.payee_match}"`}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {confirmDeactivate === bill.id ? (
                    <>
                      <span className="text-xs text-slate-400">Deactivate?</span>
                      <button onClick={() => handleDeactivate(bill.id)}
                        className="text-xs px-2 py-1 rounded bg-red-900 text-red-300 hover:bg-red-800 cursor-pointer">Yes</button>
                      <button onClick={() => setConfirmDeactivate(null)}
                        className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer">No</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(bill)}
                        className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer">
                        Edit
                      </button>
                      <button onClick={() => setConfirmDeactivate(bill.id)}
                        className="text-xs px-3 py-1.5 rounded border border-red-900 text-red-400 hover:bg-red-900/30 transition-colors cursor-pointer">
                        Deactivate
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: 3-Month Outlook */}
        {activeBills.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#1e293b" }}>
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">3-Month Outlook</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-5 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Bill</th>
                    {months.map((m) => (
                      <th key={m} className="px-5 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-right">{m}</th>
                    ))}
                    <th className="px-5 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-right">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBills.map((bill, i) => {
                    const amt = parseFloat(bill.amount)
                    return (
                      <tr key={bill.id} className="border-b border-slate-700/50 last:border-0"
                        style={{ backgroundColor: i % 2 === 1 ? "#162032" : undefined }}>
                        <td className="px-5 py-3 text-slate-200">
                          {bill.name}
                          {bill.is_variable && <span className="ml-1 text-xs text-slate-500">~</span>}
                        </td>
                        {months.map((m) => (
                          <td key={m} className="px-5 py-3 text-right"
                            style={{ fontFamily: "var(--font-mono)", color: "#f43f5e" }}>
                            ${amt.toFixed(2)}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-right"
                          style={{ fontFamily: "var(--font-mono)", color: "#94a3b8" }}>
                          ${(amt * 12).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-slate-600 font-semibold">
                    <td className="px-5 py-3 text-slate-200">Total</td>
                    {months.map((m) => (
                      <td key={m} className="px-5 py-3 text-right"
                        style={{ fontFamily: "var(--font-mono)", color: "#f59e0b" }}>
                        ${totalBills.toFixed(2)}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right"
                      style={{ fontFamily: "var(--font-mono)", color: "#f59e0b" }}>
                      ${annualTotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="px-5 py-3 text-xs text-slate-500">
                Based on expected amounts. Variable bills use current expected value.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
