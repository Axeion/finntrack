"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useState } from "react"

interface HeaderProps {
  lastSync?: string | null
  onSyncComplete?: () => void
}

export default function Header({ lastSync, onSyncComplete }: HeaderProps) {
  const pathname = usePathname()
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  async function runSync(daysBack: number) {
    setSyncing(true)
    setShowMenu(false)
    setStatus("Syncing…")
    try {
      const secret = process.env.NEXT_PUBLIC_CRON_SECRET ?? ""
      const res = await fetch(`/api/cron/sync?daysBack=${daysBack}`, {
        headers: { Authorization: `Bearer ${secret}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Sync failed")
      setStatus(`+${data.transactionsImported} txns`)
      onSyncComplete?.()

      // If there are still uncategorized transactions, keep batching
      if (data.transactionsImported > 0 || data.categorized > 0) {
        await runCategorize(secret)
      }
    } catch {
      setStatus("Error")
    } finally {
      setSyncing(false)
      setTimeout(() => setStatus(null), 5000)
    }
  }

  async function runCategorize(secret?: string) {
    const s = secret ?? process.env.NEXT_PUBLIC_CRON_SECRET ?? ""
    setStatus("Categorizing…")
    let remaining = Infinity
    let passes = 0
    while (remaining > 0 && passes < 20) {
      const res = await fetch(`/api/cron/categorize?batch=8`, {
        headers: { Authorization: `Bearer ${s}` },
      })
      const data = await res.json()
      if (!res.ok) break
      remaining = data.remaining ?? 0
      passes++
      setStatus(`Categorizing… (${remaining} left)`)
      if (remaining === 0) break
    }
    setStatus("Done ✓")
    onSyncComplete?.()
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        pathname === href ? "text-white" : "text-slate-400 hover:text-white"
      }`}
      style={pathname === href ? { backgroundColor: "#1e293b" } : undefined}
    >
      {label}
    </Link>
  )

  const isError = status === "Error"
  const isDone = status?.startsWith("Done")

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800" style={{ backgroundColor: "#0f172a" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <span className="font-bold text-white text-lg" style={{ fontFamily: "var(--font-mono)" }}>
            FinTrack
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {navLink("/", "Dashboard")}
          {navLink("/transactions", "Transactions")}
          {navLink("/bills", "Bills")}
        </nav>

        <div className="flex items-center gap-3">
          {lastSync && !status && (
            <span className="text-xs text-slate-500 hidden sm:block">
              Synced {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {status && (
            <span className="text-xs hidden sm:block" style={{ color: isError ? "#f43f5e" : isDone ? "#10b981" : "#f59e0b" }}>
              {status}
            </span>
          )}

          {/* Sync button with dropdown */}
          <div className="relative">
            <div className="flex items-center rounded-md border border-slate-700 overflow-hidden">
              <button
                onClick={() => runSync(2)}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={syncing ? "animate-spin" : ""}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {syncing ? "…" : "Sync"}
              </button>
              <button
                disabled={syncing}
                onClick={() => setShowMenu(!showMenu)}
                className="text-xs px-1.5 py-1.5 text-slate-500 hover:text-white hover:bg-slate-800 border-l border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                ▾
              </button>
            </div>

            {showMenu && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg border border-slate-700 py-1 z-50 w-48"
                style={{ backgroundColor: "#1e293b" }}
              >
                <button
                  onClick={() => runSync(2)}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Sync last 2 days
                </button>
                <button
                  onClick={() => runSync(30)}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Sync last 30 days
                </button>
                <button
                  onClick={() => runSync(365)}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Sync full history (1 year)
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => { setShowMenu(false); setSyncing(true); runCategorize().finally(() => setSyncing(false)) }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Re-categorize uncategorized
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
