/** Phase 4 checks over the built site: the election-day page's claims, links and reach. */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { electionDay } from '@/lib/data'

const OUT = path.resolve('out')
const html = fs.readFileSync(path.join(OUT, 'election-day', 'index.html'), 'utf8')
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
    expect(external.filter(h => !INEC_HOSTS.has(h))).toEqual([])
  })

  it('every claim names its INEC source, and that source is cited with a date on the page', () => {
    const claims = [...html.matchAll(/data-claim="true" data-source="([^"]+)"/g)].map(m => m[1])
    expect(claims.length).toBe(electionDay().steps.length + electionDay().elections.length)
    for (const id of new Set(claims)) {
      expect(html).toMatch(new RegExp(`<p class="cite" data-source="${id}"><a href="https://www\\.inecnigeria\\.org/[^"]+">[^<]+, retrieved <time dateTime="\\d{4}-\\d{2}-\\d{2}">`))
    }
  })

  it('shows every step from the reviewed data, and nothing else in the steps list', () => {
    const items = [...html.matchAll(/<li data-claim="true" data-source="inec-voter-education">([^<]+)<\/li>/g)].map(m => m[1].replaceAll('&#x27;', '\''))
    expect(items).toEqual(electionDay().steps.map(s => s.text))
  })

  it('is linked from the header of every page', () => {
    for (const f of [...walk(OUT)].filter(x => x.endsWith('.html'))) {
      expect(fs.readFileSync(f, 'utf8'), f).toContain('<a href="/election-day/" class="site-nav">Election day</a>')
    }
  })
})
