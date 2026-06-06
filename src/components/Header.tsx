"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useState } from "react"

interface HeaderProps {
  lastSync?: string | null
  onSyncComplete?: () => void
}

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/reports", label: "Reports" },
  { href: "/insights", label: "Insights" },
  { href: "/bills", label: "Bills" },
  { href: "/rules", label: "Rules" },
  { href: "/settings", label: "Settings" },
]

export default function Header({ lastSync, onSyncComplete }: HeaderProps) {
  const pathname = usePathname()
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [showSyncMenu, setShowSyncMenu] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)

  async function runSync(daysBack: number) {
    setSyncing(true)
    setShowSyncMenu(false)
    setShowMobileNav(false)
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
      const res = await fetch(`/api/cron/categorize?batch=8`, { headers: { Authorization: `Bearer ${s}` } })
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

  const isError = status === "Error"
  const isDone = status?.startsWith("Done")

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-800" style={{ backgroundColor: "#0f172a" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span className="font-bold text-white text-base" style={{ fontFamily: "var(--font-mono)" }}>FinTrack</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === href ? "text-white" : "text-slate-400 hover:text-white"}`}
                style={pathname === href ? { backgroundColor: "#1e293b" } : undefined}>
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {status && (
              <span className="text-xs hidden sm:block" style={{ color: isError ? "#f43f5e" : isDone ? "#10b981" : "#f59e0b" }}>
                {status}
              </span>
            )}
            {lastSync && !status && (
              <span className="text-xs text-slate-500 hidden lg:block">
                {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}

            {/* Sync button */}
            <div className="relative">
              <div className="flex items-center rounded-md border border-slate-700 overflow-hidden">
                <button onClick={() => runSync(2)} disabled={syncing}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "animate-spin" : ""}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span className="hidden sm:inline">{syncing ? "…" : "Sync"}</span>
                </button>
                <button disabled={syncing} onClick={() => setShowSyncMenu(!showSyncMenu)}
                  className="text-xs px-1.5 py-1.5 text-slate-500 hover:text-white hover:bg-slate-800 border-l border-slate-700 transition-colors disabled:opacity-50 cursor-pointer">
                  ▾
                </button>
              </div>
              {showSyncMenu && (
                <div className="absolute right-0 top-full mt-1 rounded-lg border border-slate-700 py-1 z-50 w-48" style={{ backgroundColor: "#1e293b" }}>
                  {[["Sync last 2 days", 2], ["Sync last 30 days", 30], ["Sync full history (1 year)", 365]].map(([label, days]) => (
                    <button key={days} onClick={() => runSync(days as number)}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer">
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-slate-700 my-1" />
                  <button onClick={() => { setShowSyncMenu(false); setSyncing(true); runCategorize().finally(() => setSyncing(false)) }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer">
                    Re-categorize uncategorized
                  </button>
                </div>
              )}
            </div>

            {/* Sign out — desktop only */}
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              className="hidden md:block text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-md hover:bg-slate-800 cursor-pointer">
              Sign out
            </button>

            {/* Hamburger — mobile only */}
            <button onClick={() => setShowMobileNav(!showMobileNav)}
              className="md:hidden p-2 text-slate-400 hover:text-white cursor-pointer rounded-md hover:bg-slate-800">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showMobileNav
                  ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                  : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {showMobileNav && (
          <div className="md:hidden border-t border-slate-800 px-4 py-3 space-y-1" style={{ backgroundColor: "#0f172a" }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setShowMobileNav(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname === href ? "text-white bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>
                {label}
              </Link>
            ))}
            <div className="border-t border-slate-800 pt-2 mt-2">
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
