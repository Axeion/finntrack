const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const cron = require("node-cron")

const dev = false
const hostname = "0.0.0.0"
const port = parseInt(process.env.PORT || "3000", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true)
    await handle(req, res, parsedUrl)
  }).listen(port, hostname, () => {
    console.log(`> FinTrack ready on http://${hostname}:${port}`)
    scheduleCronJobs()
  })
})

function callCron(path) {
  const url = `http://localhost:${port}${path}`
  fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
    .then((r) => r.json())
    .then((data) => console.log(`[cron] ${path}:`, data))
    .catch((err) => console.error(`[cron] ${path} failed:`, err.message))
}

function scheduleCronJobs() {
  // Sync every hour
  cron.schedule("0 * * * *", () => {
    console.log("[cron] Running hourly sync")
    callCron("/api/cron/sync")
  })

  // Categorize remaining uncategorized every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    callCron("/api/cron/categorize?batch=20")
  })

  // Daily email at 8am UTC
  cron.schedule("0 8 * * *", () => {
    console.log("[cron] Sending daily email")
    callCron("/api/cron/daily-email")
  })

  // Weekly email Monday 8am UTC
  cron.schedule("0 8 * * 1", () => {
    console.log("[cron] Sending weekly email")
    callCron("/api/cron/weekly-email")
  })

  // Net worth snapshot on 1st of each month
  cron.schedule("0 9 1 * *", () => {
    console.log("[cron] Saving net worth snapshot")
    fetch(`http://localhost:${port}/api/networth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch((err) => console.error("[cron] Net worth snapshot failed:", err.message))
  })

  console.log("[cron] Jobs scheduled: sync (hourly), categorize (30min), daily/weekly email, net worth (1st of month)")
}
