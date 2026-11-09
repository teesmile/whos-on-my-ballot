// Page-weight budgets from the working rules §4, measured gzipped on the built site.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT = path.resolve('out')
const KB = 1024
const BUDGET = { htmlCss: 60 * KB, js: 30 * KB, stateData: 150 * KB }
const gz = buf => zlib.gzipSync(buf, { level: 9 }).length

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const cssCache = new Map()
let worstPage = { size: 0 }
let worstJs = { size: 0 }
let fails = 0
for (const f of walk(OUT)) {
  if (!f.endsWith('.html')) continue
  const html = fs.readFileSync(f)
  let size = gz(html)
  for (const [, href] of html.toString().matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
    if (!cssCache.has(href)) cssCache.set(href, gz(fs.readFileSync(path.join(OUT, href))))
    size += cssCache.get(href)
  }
  let js = 0
  for (const [, src] of html.toString().matchAll(/<script[^>]*src="([^"]+)"/g)) js += gz(fs.readFileSync(path.join(OUT, src)))
  if (size > worstPage.size) worstPage = { size, f }
  if (js > worstJs.size) worstJs = { size: js, f }
  if (size > BUDGET.htmlCss || js > BUDGET.js) fails++
}
const states = [...walk(path.join(OUT, 'data/pu'))].map(f => ({ f, size: gz(fs.readFileSync(f)) })).sort((a, b) => b.size - a.size)
const rel = f => path.relative(OUT, f)
console.log(`HTML+CSS per page, gzipped: largest ${(worstPage.size / KB).toFixed(1)} KB (${rel(worstPage.f)}); budget 60 KB`)
console.log(`JS per page, gzipped: largest ${(worstJs.size / KB).toFixed(1)} KB (${worstJs.f ? rel(worstJs.f) : 'none'}); budget 30 KB`)
console.log(`State search data, gzipped: largest ${(states[0].size / KB).toFixed(1)} KB (${rel(states[0].f)}), smallest ${(states.at(-1).size / KB).toFixed(1)} KB; budget 150 KB`)
if (states[0].size > BUDGET.stateData) fails++
console.log(fails ? `FAIL: ${fails} over budget` : 'PASS: every page and state file within budget')
process.exit(fails ? 1 : 0)
