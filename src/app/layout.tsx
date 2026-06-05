import type { Metadata } from "next"
import { Instrument_Sans, DM_Mono } from "next/font/google"
import "./globals.css"

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "FinTrack",
  description: "Personal Finance Dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${dmMono.variable} h-full`}>
      <body
        className="min-h-full"
        style={{ backgroundColor: "#0f172a", color: "#e2e8f0", fontFamily: "var(--font-sans)" }}
      >
        {children}
      </body>
    </html>
  )
}
