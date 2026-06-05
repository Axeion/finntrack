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
  const [syncResult, setSyncResult] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/cron/sync", {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Sync failed")
      setSyncResult(`+${data.transactionsImported} txns`)
      onSyncComplete?.()
      setTimeout(() => setSyncResult(null), 4000)
    } catch (err) {
      setSyncResult("Error")
      setTimeout(() => setSyncResult(null), 4000)
    } finally {
      setSyncing(false)
    }
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
          {lastSync && (
            <span className="text-xs text-slate-500 hidden sm:block">
              Synced {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            style={{
              color: syncResult === "Error" ? "#f43f5e" : syncResult ? "#10b981" : "#94a3b8",
              borderColor: syncResult === "Error" ? "#f43f5e44" : syncResult ? "#10b98144" : undefined,
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={syncing ? "animate-spin" : ""}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {syncing ? "Syncing…" : syncResult ?? "Sync"}
          </button>

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
