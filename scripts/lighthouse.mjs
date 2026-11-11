// Lighthouse (mobile, simulated slow 4G, Moto G Power profile) on the heaviest pages of the built site.
// Thresholds from the plan: Performance >= 95, Accessibility = 100, LCP < 2.0 s.
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'

const PORT = 4323
const PAGES = process.env.LH_PAGES ? process.env.LH_PAGES.split(',') : [
  '/',
  '/state/24/',
  '/ward/24-15-03/',
  '/ballot/adamawa/gombi-hong--adamawa-central-or-adamawa-north-or-adamawa-south/',
  '/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/',
  '/c/jan-2027-president-ndc/',
  '/c/jan-2027-house-fct-municipal-bwari-apc/',
  '/election-day/',
  '/ballot-feb/abia/umuahia-central-or-umuahia-east-or-umuahia-north/',
  '/ballot-feb/rivers/oyigbo-or-tai/',
  '/c/feb-2027-governor-taraba-apc/',
]

// LH_PROFILE=slow3g: a low-end Android phone on slow 3G (400 ms round trip, 400 kbps down, CPU 6x slower), the working
// rules' first design target. Pass: accessibility 100 and LCP under 4 s (the line between "needs improvement" and "poor").
const SLOW = process.env.LH_PROFILE === 'slow3g'
const config = SLOW
  ? { extends: 'lighthouse:default', settings: { formFactor: 'mobile', throttlingMethod: 'simulate', throttling: { rttMs: 400, throughputKbps: 400, cpuSlowdownMultiplier: 6 }, screenEmulation: { mobile: true, width: 360, height: 640, deviceScaleFactor: 2, disabled: false } } }
  : undefined
if (SLOW) console.log('Profile: slow 3G, low-end phone (400 ms RTT, 400 kbps, CPU x6, 360 px)')

const server = spawn('node', ['scripts/serve-out.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
await sleep(800)
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] })
let failed = 0
try {
  for (const p of PAGES) {
    const { lhr } = await lighthouse(`http://localhost:${PORT}${p}`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility'], formFactor: 'mobile' }, config)
    const perf = Math.round(lhr.categories.performance.score * 100)
    const a11y = Math.round(lhr.categories.accessibility.score * 100)
    const lcp = lhr.audits['largest-contentful-paint'].numericValue / 1000
    const ok = SLOW ? a11y === 100 && lcp < 4.0 : perf >= 95 && a11y === 100 && lcp < 2.0
    if (!ok) failed++
    // name what failed, so a drop is never a mystery
    if (a11y < 100) for (const a of Object.values(lhr.audits).filter(a => a.score === 0 && lhr.categories.accessibility.auditRefs.some(r => r.id === a.id))) console.log(`  ${a.id}: ${(a.details?.items ?? []).map(i => i.node?.snippet).filter(Boolean).slice(0, 4).join(' | ')}`)
    console.log(`${ok ? 'PASS' : 'FAIL'} ${p}  performance ${perf}  accessibility ${a11y}  LCP ${lcp.toFixed(2)} s  TBT ${Math.round(lhr.audits['total-blocking-time'].numericValue)} ms  CLS ${lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)}`)
  }
}
finally {
  await chrome.kill()
  server.kill()
}
process.exit(failed ? 1 : 0)
