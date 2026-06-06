"use client"

import { useState } from "react"
import Header from "@/components/Header"

interface Action {
  id: string
  label: string
  description: string
  danger: boolean
  confirm: string
}

const ACTIONS: Action[] = [
  {
    id: "reset-categories",
    label: "Clear AI Categories & Re-process",
    description: "Clears all AI-assigned categories (keeps any you manually set to 100% confidence). Then re-runs categorization using your rules + built-in keywords.",
    danger: false,
    confirm: "Clear AI categories and re-process?",
  },
  {
    id: "reset-categories-all",
    label: "Clear ALL Categories",
    description: "Wipes every category on every transaction, including ones you manually corrected. Re-run sync or categorize to start fresh.",
    danger: true,
    confirm: "This will wipe all categories including manual edits. Continue?",
  },
  {
    id: "delete-transactions",
    label: "Delete All Transactions",
    description: "Permanently deletes all transaction data, splits, and bill payment records. Accounts remain. Re-sync from SimpleFIN to repopulate.",
    danger: true,
    confirm: "Permanently delete ALL transactions? This cannot be undone.",
  },
  {
    id: "delete-all-data",
    label: "Full Data Reset",
    description: "Deletes all transactions, splits, bill payment history, net worth snapshots, categorization rules, and spending targets. Accounts remain. Use this to start completely fresh.",
    danger: true,
    confirm: "Full reset — all data will be permanently deleted. Are you sure?",
  },
]

function DangerCard({ action }: { action: Action }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  async function run() {
    if (!confirmed) { setConfirmed(true); return }
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // If reset-categories, also trigger re-categorize
      if (action.id === "reset-categories" || action.id === "reset-categories-all") {
        setResult("Categories cleared. Running re-categorization…")
        const secret = process.env.NEXT_PUBLIC_CRON_SECRET ?? ""
        let remaining = Infinity
        let passes = 0
        while (remaining > 0 && passes < 50) {
          const r = await fetch("/api/cron/categorize?batch=20", {
            headers: { Authorization: `Bearer ${secret}` },
          })
          const d = await r.json()
          if (!r.ok) break
          remaining = d.remaining ?? 0
          passes++
          setResult(`Re-categorizing… (${remaining} remaining)`)
          if (remaining === 0) break
        }
        setResult(`Done — re-categorized ${passes * 20} transactions.`)
      } else {
        setResult(data.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setRunning(false)
      setConfirmed(false)
    }
  }

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "#1e293b", borderLeft: action.danger ? "3px solid #f43f5e" : "3px solid #10b981" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{action.label}</h3>
          <p className="text-xs text-slate-400 mt-1">{action.description}</p>
          {result && <p className="text-xs mt-2" style={{ color: "#10b981" }}>{result}</p>}
          {error && <p className="text-xs mt-2" style={{ color: "#f43f5e" }}>{error}</p>}
          {confirmed && !running && (
            <p className="text-xs mt-2 font-medium" style={{ color: "#f59e0b" }}>⚠ {action.confirm} Click again to confirm.</p>
          )}
        </div>
        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 shrink-0"
          style={{
            backgroundColor: confirmed ? "#f43f5e" : action.danger ? "#1e293b" : "#10b981",
            color: confirmed ? "#fff" : action.danger ? "#f43f5e" : "#fff",
            border: action.danger && !confirmed ? "1px solid #f43f5e" : "none",
          }}
        >
          {running ? "Running…" : confirmed ? "Confirm" : action.label}
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div style={{ backgroundColor: "#0f172a" }} className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Data management and maintenance operations.</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data Management</h2>
          {ACTIONS.map((a) => <DangerCard key={a.id} action={a} />)}
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: "#1e293b" }}>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Environment</h3>
          <div className="space-y-2 text-xs font-mono">
            {[
              ["SimpleFIN", process.env.NEXT_PUBLIC_CRON_SECRET ? "Configured" : "Not set"],
              ["CRON_SECRET", process.env.NEXT_PUBLIC_CRON_SECRET ? "Set" : "Missing"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-300">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
