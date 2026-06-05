# FinTrack — Project Context

## Stack
Next.js 14 (App Router), Drizzle ORM, Neon PostgreSQL (@neondatabase/serverless),
Tailwind CSS, Recharts, Resend, Vercel Cron

## Key Rules
- Always use drizzle-orm for queries, never raw SQL strings
- Use @neondatabase/serverless, NOT pg (required for Vercel serverless)
- Monetary values stored as `numeric` in DB, cast with parseFloat() in TS
- Negative transaction amount = expense, positive = income (SimpleFIN convention)
- All cron routes validate Authorization: Bearer {CRON_SECRET} header

## External Services
- Ollama: https://ollama.stationmind.cloud/v1 — model: qwen2.5:7b
- SimpleFIN: access URL from SIMPLEFIN_ACCESS_URL env var
- Email: Resend via RESEND_API_KEY

## Categories (exactly these 15, no others)
Income, Groceries, Dining & Restaurants, Transportation, Utilities & Bills,
Subscriptions & Streaming, Shopping & Retail, Health & Medical, Housing & Rent,
Personal Care, Entertainment, Travel, Insurance, Transfers & Payments, Miscellaneous

## Design System
Dark theme: bg #0f172a, cards #1e293b, accent green #10b981, expense red #f43f5e
Fonts: Instrument Sans (body), DM Mono (numbers)
