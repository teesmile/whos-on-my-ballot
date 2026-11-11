/** Phase 4 checks over the built site: the election-day page's claims, links and reach. */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { electionDay } from '@/lib/data'

const OUT = path.resolve('out')
const page = fs.readFileSync(path.join(OUT, 'election-day', 'index.html'), 'utf8')
// the page's own content: the footer (sources, credit) is shared by every page and checked elsewhere
const html = page.split('<main')[1].split('</main>')[0]
const INEC_HOSTS = new Set(['www.inecnigeria.org', 'inecnigeria.org', 'cvr.inecnigeria.org', 'inecelectionresults.ng'])

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

describe('election-day page', () => {
  it('every external link goes to an INEC domain (an Internet Archive copy counts only if it archives an INEC page)', () => {
    const inecHost = (href: string) => {
      const u = new URL(href)
      if (u.hostname === 'web.archive.org') {
        const archived = /^\/web\/\d+\/(https?:\/\/.+)$/.exec(u.pathname)
        return archived ? new URL(archived[1]).hostname : u.hostname
      }
      return u.hostname
    }
    const external = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => inecHost(m[1]))
    expect(external.length).toBeGreaterThan(5)
    // the one exception: the civic note's citation of the Constitution at the National Library of Nigeria (D-034)
    expect(external.filter(h => !INEC_HOSTS.has(h) && h !== 'nigeriareposit.nln.gov.ng')).toEqual([])
  })

  it('every claim names its INEC source, and that source is cited with a date on the page', () => {
    const claims = [...html.matchAll(/data-claim="true" data-source="([^"]+)"/g)].map(m => m[1])
    expect(claims.length).toBe(electionDay().steps.length + electionDay().elections.length)
    for (const id of new Set(claims)) {
      expect(html).toMatch(new RegExp(`<p class="cite" data-source="${id}"><a href="https://www\\.inecnigeria\\.org/[^"]+">[^<]+, retrieved <time dateTime="\\d{4}-\\d{2}-\\d{2}">`))
    }
  })

  it('shows every step from the reviewed data, and nothing else in the steps list', () => {
    const items = [...html.matchAll(/<li class="step-card" data-claim="true" data-source="inec-voter-education"><span class="step-n" aria-hidden="true">\d+<\/span><p>([^<]+)<\/p><\/li>/g)].map(m => m[1].replaceAll('&#x27;', '\''))
    expect(items).toEqual(electionDay().steps.map(s => s.text))
  })

  it('is linked from the header of every page', () => {
    for (const f of [...walk(OUT)].filter(x => x.endsWith('.html'))) {
      const page = fs.readFileSync(f, 'utf8')
      const rel = `/${path.relative(OUT, path.dirname(f)).split(path.sep).join('/')}/`.replace('//', '/')
      const mark = (section: string) => (rel === section ? ' aria-current="page"' : rel.startsWith(section) ? ' aria-current="true"' : '')
      expect(page, f).toContain(`<a href="/election-day/" class="site-nav"${mark('/election-day/')}>Election day</a>`)
      expect(page, f).toContain(`<a href="/results/" class="site-nav"${mark('/results/')}>Results</a>`)
      expect(page, f).toContain(`<a href="/about/" class="site-nav"${mark('/about/')}>About</a>`)
    }
  })
})
