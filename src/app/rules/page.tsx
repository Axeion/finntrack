"use client"

import { useEffect, useState } from "react"
import Header from "@/components/Header"
import CategoryPill from "@/components/CategoryPill"
import { CATEGORIES, Category } from "@/lib/constants"

interface Rule {
  id: number
  payee_pattern: string
  category: string
  priority: number
  is_active: boolean
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [newPattern, setNewPattern] = useState("")
  const [newCategory, setNewCategory] = useState<Category>(CATEGORIES[1])
  const [saving, setSaving] = useState(false)

  async function loadRules() {
    const res = await fetch("/api/rules")
    const data = await res.json()
    setRules(data.filter((r: Rule) => r.is_active))
    setLoading(false)
  }

  useEffect(() => { loadRules() }, [])

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    if (!newPattern.trim()) return
    setSaving(true)
    await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payee_pattern: newPattern.trim(), category: newCategory, priority: 0 }),
    })
    setNewPattern("")
    await loadRules()
    setSaving(false)
  }

  async function deleteRule(id: number) {
    await fetch(`/api/rules/${id}`, { method: "DELETE" })
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Categorization Rules</h1>
          <p className="text-sm text-slate-400 mt-1">
            Rules run before the AI — if a payee name contains the pattern, it gets that category automatically.
          </p>
        </div>

        {/* Add rule form */}
        <form onSubmit={addRule} className="rounded-xl p-4 sm:p-6 space-y-4" style={{ backgroundColor: "#1e293b" }}>
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Add Rule</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-400 mb-1">Payee contains…</label>
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. Starbucks"
                className="w-full px-3 py-2 rounded-md text-sm bg-slate-700 text-slate-200 border border-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as Category)}
                className="px-3 py-2 rounded-md text-sm bg-slate-700 text-slate-200 border border-slate-600 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !newPattern.trim()}
              className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "#10b981" }}
            >
              {saving ? "Saving…" : "Add Rule"}
            </button>
          </div>
        </form>

        {/* Rules list */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#1e293b" }}>
          <div className="px-4 sm:px-6 py-4 border-b border-slate-700">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Active Rules {!loading && `(${rules.length})`}
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No rules yet. Add one above to override AI categorization for specific merchants.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 sm:px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Pattern</th>
                  <th className="px-4 sm:px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-left">Category</th>
                  <th className="px-4 sm:px-6 py-3 text-xs text-slate-400 font-medium uppercase tracking-wide text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, i) => (
                  <tr key={rule.id} className="border-b border-slate-700/50 last:border-0"
                    style={{ backgroundColor: i % 2 === 1 ? "#162032" : undefined }}>
                    <td className="px-4 sm:px-6 py-3 text-slate-200 font-mono text-sm">{rule.payee_pattern}</td>
                    <td className="px-4 sm:px-6 py-3"><CategoryPill category={rule.category} /></td>
                    <td className="px-4 sm:px-6 py-3 text-right">
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
