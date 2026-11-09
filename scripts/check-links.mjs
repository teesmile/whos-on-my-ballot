// Network check: every external link on the election-day page answers. Run before each release: `pnpm check-links`.
import fs from 'node:fs'

const html = fs.readFileSync('out/election-day/index.html', 'utf8')
const urls = [...new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]))]
let failed = 0
for (const url of urls) {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'whos-on-my-ballot-link-check/0.1 (+https://github.com/teesmile/whos-on-my-ballot)' } })
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.status} ${url}`)
    if (!r.ok) failed++
  }
  catch (e) {
    console.log(`FAIL ${e.cause?.code ?? e.message} ${url}`)
    failed++
  }
}
process.exit(failed ? 1 : 0)
