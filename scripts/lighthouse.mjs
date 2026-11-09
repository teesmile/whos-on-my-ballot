// Lighthouse (mobile, simulated slow 4G, Moto G Power profile) on the heaviest pages of the built site.
// Thresholds from the plan: Performance >= 95, Accessibility = 100, LCP < 2.0 s.
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'

const PORT = 4323
const PAGES = [
  '/',
  '/state/24/',
  '/ward/24-15-03/',
  '/ballot/adamawa/gombi-hong--adamawa-central-or-adamawa-north-or-adamawa-south/',
  '/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/',
  '/c/jan-2027-president-ndc/',
  '/c/jan-2027-house-fct-municipal-bwari-apc/',
  '/election-day/',
]

const server = spawn('node', ['scripts/serve-out.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
await sleep(800)
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] })
let failed = 0
try {
  for (const p of PAGES) {
    const { lhr } = await lighthouse(`http://localhost:${PORT}${p}`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility'], formFactor: 'mobile' })
    const perf = Math.round(lhr.categories.performance.score * 100)
    const a11y = Math.round(lhr.categories.accessibility.score * 100)
    const lcp = lhr.audits['largest-contentful-paint'].numericValue / 1000
    const ok = perf >= 95 && a11y === 100 && lcp < 2.0
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${p}  performance ${perf}  accessibility ${a11y}  LCP ${lcp.toFixed(2)} s  TBT ${Math.round(lhr.audits['total-blocking-time'].numericValue)} ms  CLS ${lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)}`)
  }
}
finally {
  await chrome.kill()
  server.kill()
}
process.exit(failed ? 1 : 0)
