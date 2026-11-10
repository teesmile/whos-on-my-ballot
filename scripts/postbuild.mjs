// After `next build`: turn the export into plain HTML plus one small module (decision D-022).
// 1. Bundle src/client/lookup.ts to out/lookup.js.
// 2. Remove every framework <script> and script preload from the HTML; add lookup.js only where a page has [data-lookup], [data-copy] or [data-countdown].
// 3. Delete the framework's JS files and RSC payloads (.txt), which nothing references any more. CSS stays.
// 4. Fail if any HTML still loads a script other than /lookup.js (structured-data blocks are data and stay).
import fs from 'node:fs'
import path from 'node:path'

import { build } from 'esbuild'

const OUT = path.resolve('out')

await build({
  entryPoints: ['src/client/lookup.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: path.join(OUT, 'lookup.js'),
  legalComments: 'none',
})

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script>/g
const PRELOAD = /<link\b[^>]*\b(?:rel="(?:modulepreload|preload)"[^>]*\bas="script"|rel="modulepreload")[^>]*\/?>/g

let pages = 0
let removedTxt = 0
for (const file of walk(OUT)) {
  if (file.endsWith('.txt') && !file.endsWith('robots.txt')) {
    fs.unlinkSync(file)
    removedTxt++
    continue
  }
  if (!file.endsWith('.html')) continue
  let html = fs.readFileSync(file, 'utf8')
  // React's empty separator comments between adjacent text nodes carry no content.
  // Structured data (application/ld+json) is data, never executed: it stays (D-032). Every other script goes.
  html = html.replace(SCRIPT, s => (s.startsWith('<script type="application/ld+json">') ? s : '')).replace(PRELOAD, '').replaceAll('<!-- -->', '')
  if (html.includes('data-lookup=') || html.includes('data-copy=') || html.includes('data-countdown=')) html = html.replace('</body>', '<script type="module" src="/lookup.js"></script></body>')
  const left = [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]).filter(s => !s.includes('src="/lookup.js"') && s !== '<script type="application/ld+json">')
  if (left.length) throw new Error(`${file} still has scripts: ${left.join(' ')}`)
  if (/\/_next\/static\/[^"']+\.js/.test(html)) throw new Error(`${file} still references framework JS`)
  fs.writeFileSync(file, html)
  pages++
}
let removedJs = 0
for (const file of walk(path.join(OUT, '_next'))) {
  if (file.endsWith('.js') || file.endsWith('.js.map')) {
    fs.unlinkSync(file)
    removedJs++
  }
}
console.log(`postbuild: ${pages} pages stripped of framework JS, ${removedJs} framework JS files and ${removedTxt} RSC payloads removed, lookup.js ${fs.statSync(path.join(OUT, 'lookup.js')).size} bytes`)
