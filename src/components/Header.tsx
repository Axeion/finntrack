"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

interface HeaderProps {
  lastSync?: string | null
}

export default function Header({ lastSync }: HeaderProps) {
  const pathname = usePathname()

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        pathname === href
          ? "text-white"
          : "text-slate-400 hover:text-white"
      }`}
      style={pathname === href ? { backgroundColor: "#1e293b" } : undefined}
    >
      {label}
    </Link>
  )

  return (
    <header
      className="sticky top-0 z-50 border-b border-slate-800"
      style={{ backgroundColor: "#0f172a" }}
    >
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

        <div className="flex items-center gap-4">
          {lastSync && (
            <span className="text-xs text-slate-500 hidden sm:block">
              Synced {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
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
