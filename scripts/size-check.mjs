// Page-weight budgets from the working rules §4, measured gzipped on the built site.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT = path.resolve('out')
const KB = 1024
// Images (party logos D-043, photos D-065, D-071) are outside the HTML+CSS budget, but held small (owner decision, 13 Nov
// 2026): the images a page loads at once (its first screen) at most 60 KB, and each race's photos at most 30 KB. An image
// marked loading="lazy" loads only when its race is shown, so it counts towards its race's cap, not the first screen.
// Requests: a ballot page's first view makes at most 6 (page, stylesheet, script, the page's one image, icon, manifest).
const BUDGET = { htmlCss: 60 * KB, js: 30 * KB, stateData: 150 * KB, pageImages: 60 * KB, racePhotos: 30 * KB, ballotRequests: 6 }
const gz = buf => zlib.gzipSync(buf, { level: 9 }).length

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const rel = f => path.relative(OUT, f)
const cssCache = new Map()
let worstPage = { size: 0 }
let worstJs = { size: 0 }
let worstLogos = { size: 0 }
let worstRequests = { n: 0 }
const logoSize = new Map()
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
  let logos = 0
  // eager images only: SVG <image> and <img> without loading="lazy"
  const tags = [...html.toString().matchAll(/<(?:image[^>]*?href|img[^>]*?src)="(\/[^"]+)"[^>]*>/g)]
  const images = new Set(tags.filter(m => !/loading="lazy"/.test(m[0])).map(m => m[1].split('?')[0]))
  for (const src of images) {
    if (!logoSize.has(src)) logoSize.set(src, fs.statSync(path.join(OUT, src)).size)
    logos += logoSize.get(src)
  }
  if (logos > worstLogos.size) worstLogos = { size: logos, f }
  if (logos > BUDGET.pageImages) fails++
  if (rel(f).startsWith('ballot')) {
    // The page, its stylesheets and script, each distinct image, one icon and the manifest.
    const requests = 1 + [...html.toString().matchAll(/<link rel="stylesheet"/g)].length + [...html.toString().matchAll(/<script[^>]*src=/g)].length
      + images.size + 1 + (html.includes('rel="manifest"') ? 1 : 0)
    if (requests > worstRequests.n) worstRequests = { n: requests, f }
    if (requests > BUDGET.ballotRequests) fails++
  }
  if (size > worstPage.size) worstPage = { size, f }
  if (js > worstJs.size) worstJs = { size: js, f }
  if (size > BUDGET.htmlCss || js > BUDGET.js) fails++
}
const states = [...walk(path.join(OUT, 'data/pu'))].map(f => ({ f, size: gz(fs.readFileSync(f)) })).sort((a, b) => b.size - a.size)
console.log(`HTML+CSS per page, gzipped: largest ${(worstPage.size / KB).toFixed(1)} KB (${rel(worstPage.f)}); budget 60 KB`)
console.log(`JS per page, gzipped: largest ${(worstJs.size / KB).toFixed(1)} KB (${worstJs.f ? rel(worstJs.f) : 'none'}); budget 30 KB`)
console.log(`State search data, gzipped: largest ${(states[0].size / KB).toFixed(1)} KB (${rel(states[0].f)}), smallest ${(states.at(-1).size / KB).toFixed(1)} KB; budget 150 KB`)
if (states[0].size > BUDGET.stateData) fails++
console.log(`Images on a page's first screen (logos and the first race's photos): largest ${(worstLogos.size / KB).toFixed(1)} KB (${worstLogos.f ? rel(worstLogos.f) : 'none'}); budget 60 KB`)
// Each race's photos: its image less the logos it shares with every page.
const sprite = JSON.parse(fs.readFileSync(path.resolve('data/generated/sprite.json'), 'utf8'))
const races = [['jan-2027-president', sprite.bytes], ...Object.entries(sprite.sheets).map(([id, s]) => [id, s.bytes])].map(([id, b]) => [id, b - sprite.logo_bytes])
// Senate, House and State Assembly: each race's on-demand card copies together (D-071).
const people = JSON.parse(fs.readFileSync(path.resolve('data/generated/photos.json'), 'utf8')).people
const onDemand = new Map()
for (const [id, p] of Object.entries(people)) if (p.card) onDemand.set(id.split('-').slice(0, -1).join('-'), (onDemand.get(id.split('-').slice(0, -1).join('-')) ?? 0) + p.card_bytes)
races.push(...onDemand)
const worstRace = races.sort((a, b) => b[1] - a[1])[0]
console.log(`Photos per race: largest ${(worstRace[1] / KB).toFixed(1)} KB (${worstRace[0]}, ${races.length} races with photos); budget 30 KB`)
if (worstRace[1] > BUDGET.racePhotos) fails++
console.log(`Requests for a ballot page's first view: at most ${worstRequests.n} (${worstRequests.f ? rel(worstRequests.f) : 'none'}); budget ${BUDGET.ballotRequests}`)
console.log(fails ? `FAIL: ${fails} over budget` : 'PASS: every page and state file within budget')
process.exit(fails ? 1 : 0)
