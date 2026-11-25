// Fails if an en dash (U+2013) or em dash (U+2014) appears in our source or in the built site (owner rule: plain
// hyphens only). Run after `next build`, so the Vercel build fails too.
//
// Not checked: node_modules, lockfiles, data/generated (INEC's files keep their text as printed; every read for display
// turns a long dash into a hyphen, see src/lib/plain.ts), pipeline/raw and Next's own framework chunks in out/_next.
// Allowed: verbatim source text, by key, in two files only: a source's own words and article titles in
// presidential-background.yaml (`quote:`, compared with the live page; `title:`, inside the pinned 16 January data and
// shown with hyphens) and INEC's workbook text in aliases.yaml (`workbook_text:`, compared with the workbook).
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DASH = /[\u2013\u2014]/
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.venv', 'raw', 'generated', 'test-results', 'playwright-report', '__pycache__', '.pytest_cache'])
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'uv.lock'])
const TEXT = /\.(tsx?|mjs|cjs|js|jsx|css|json|ya?ml|md|py|toml|txt|html|xml|svg|webmanifest|rss)$/i
const ALLOWED = { 'data/overrides/presidential-background.yaml': /^\s*(quote|title):/, 'pipeline/aliases.yaml': /workbook_text:/ }
const SOURCE = ['src', 'tests', 'scripts', 'data/overrides', 'data/corrections.json', 'pipeline/src', 'pipeline/tests', 'pipeline/aliases.yaml', 'public', 'README.md', 'next.config.ts', 'Makefile']

const found = []
const walk = (abs, out) => {
  if (!fs.existsSync(abs)) return
  const st = fs.statSync(abs)
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(abs)) if (!SKIP_DIRS.has(e)) walk(path.join(abs, e), out)
  } else if (!SKIP_FILES.has(path.basename(abs)) && (TEXT.test(abs) || path.basename(abs) === 'Makefile')) out.push(abs)
}
const scan = (abs) => {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/')
  const text = fs.readFileSync(abs, 'utf8')
  if (!DASH.test(text)) return
  text.split('\n').forEach((line, i) => {
    if (DASH.test(line) && !(ALLOWED[rel] && ALLOWED[rel].test(line))) { const at = line.search(DASH); found.push(`${rel}:${i + 1}: ...${line.slice(Math.max(0, at - 50), at + 30).trim()}...`) }
  })
}

const files = []
for (const s of SOURCE) walk(path.join(ROOT, s), files)
const out = path.join(ROOT, 'out')
if (fs.existsSync(out)) {
  for (const e of fs.readdirSync(out)) if (e !== '_next') walk(path.join(out, e), files)
}
files.forEach(scan)

if (found.length) {
  console.error(`FAIL: ${found.length} long dash(es); use a plain hyphen (" - " between phrases, "-" in ranges):`)
  for (const f of found.slice(0, 50)) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`PASS: no en or em dash in ${files.length} source and output files`)
