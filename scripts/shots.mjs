// Phone-width screenshots of the local build for visual review: node scripts/shots.mjs name=/path[@scrollY] ...
import { chromium } from '@playwright/test'

const dir = process.env.SHOTS_DIR ?? 'shots'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 360, height: 760 } })
for (const arg of process.argv.slice(2)) {
  const [name, rest] = arg.split('=')
  const [url, y] = rest.split('@')
  await p.goto(`http://localhost:${process.env.PORT ?? 4321}${url}`)
  await p.waitForTimeout(300)
  if (y) await p.evaluate(v => window.scrollTo(0, Number(v)), y)
  await p.screenshot({ path: `${dir}/${name}.png` })
}
await b.close()
