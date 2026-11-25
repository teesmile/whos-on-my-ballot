// After every production deploy (owner, 16 Nov 2026, D-097): keep the deployment whosonmyballot.ng points at and the
// production deployment before it, and delete every other deployment of this project. Never deletes the live one.
//
//   node scripts/vercel-prune.mjs             (locally: the Vercel CLI's own login)
//   node scripts/vercel-prune.mjs --dry-run   (lists what it would delete)
//
// In CI the Vercel CLI reads VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID from the environment; the token is passed
// to the CLI through its own environment variable and is never printed.
import { execFileSync } from 'node:child_process'

const DOMAIN = 'whosonmyballot.ng'
const PROJECT = 'whos-on-my-ballot'
const dry = process.argv.includes('--dry-run')
const auth = process.env.VERCEL_TOKEN ? ['--token', process.env.VERCEL_TOKEN] : []
const vercel = (...args) => execFileSync('vercel', [...args, ...auth], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

const live = JSON.parse(vercel('inspect', DOMAIN, '--json'))
if (!live?.url || live.target !== 'production') throw new Error(`could not tell which production deployment ${DOMAIN} points at`)

let all = []
let next = null
for (let i = 0; i < 50; i++) {
  const page = JSON.parse(vercel('ls', PROJECT, '--json', ...(next ? ['--next', String(next)] : [])))
  all = all.concat(page.deployments)
  next = page.pagination?.next
  if (!next) break
}
const liveDep = all.find(d => d.url === live.url)
if (!liveDep) throw new Error(`the live deployment ${live.url} is not in ${PROJECT}'s list; nothing deleted`)
const previous = all
  .filter(d => d.url !== live.url && d.target === 'production' && d.state === 'READY' && d.createdAt < liveDep.createdAt)
  .sort((a, b) => b.createdAt - a.createdAt)[0]
const keep = new Set([live.url, previous?.url].filter(Boolean))

console.log(`production: https://${live.url}`)
console.log(`keep: ${[...keep].map(u => `https://${u}`).join(', ')}`)
for (const d of all.filter(d => !keep.has(d.url))) {
  if (dry) { console.log(`would remove https://${d.url}`); continue }
  vercel('rm', d.url, '--yes')
  console.log(`removed https://${d.url}`)
}
