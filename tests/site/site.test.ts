/**
 * Checks over the built site in out/ (run `pnpm build` first). They read the real HTML and JSON files the
 * browser would get, and compare them with the pipeline's data.
 */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { findByCode, puHash, type StateSearchData } from '@/lib/core'
import { ballots, presidentialRace, race, races, stateGeo, states, wardBallotPath } from '@/lib/data'

const OUT = path.resolve('out')
const html = (p: string) => fs.readFileSync(path.join(OUT, p, 'index.html'), 'utf8')

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const ids = (s: string, attr: string) => [...s.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map(m => m[1])

describe('every polling unit reaches the same ballot by every route', () => {
  it('code lookup, browse links and the ward mapping agree for all polling units', () => {
    let checked = 0
    for (const s of states()) {
      const data = JSON.parse(fs.readFileSync(path.join(OUT, 'data/pu', `${s.code}.json`), 'utf8')) as StateSearchData
      const geo = stateGeo(s.code)
      for (const lga of geo.lgas) {
        for (const ward of lga.wards) {
          const expected = wardBallotPath(geo, ward)
          const page = html(`ward/${ward.code.replaceAll('/', '-')}`)
          expect(fs.existsSync(path.join(OUT, expected, 'index.html')), expected).toBe(true)
          for (const pu of ward.polling_units) {
            expect(findByCode(data, pu.code)?.ballotPath, pu.code).toBe(expected)
            expect(page.includes(`href="${expected}${puHash(pu.code)}"`), `${pu.code} link on ward page`).toBe(true)
            checked++
          }
        }
      }
    }
    expect(checked).toBe(177_299)
  })

  it('every ward page is reachable from home in four links (state, LGA, ward, then a polling unit)', () => {
    const home = html('')
    for (const s of states()) {
      expect(home.includes(`href="/state/${s.code}/"`)).toBe(true)
      const st = html(`state/${s.code}`)
      for (const l of stateGeo(s.code).lgas) {
        expect(st.includes(`href="/lga/${l.code.replace('/', '-')}/"`)).toBe(true)
        const lp = html(`lga/${l.code.replace('/', '-')}`)
        for (const w of l.wards) expect(lp.includes(`href="/ward/${w.code.replaceAll('/', '-')}/"`)).toBe(true)
      }
    }
  })
})

describe('ballot pages', () => {
  const all = ballots()

  it('one page per distinct ballot, and nothing else under /ballot/', () => {
    const built = [...walk(path.join(OUT, 'ballot'))].filter(f => f.endsWith('index.html')).length
    expect(built).toBe(all.length)
  })

  it('shows exactly its races, and each race exactly its candidates, in ballot order', () => {
    const seen = new Map<string, Set<string>>()
    for (const b of all) {
      const page = html(b.path.slice(1))
      const raceIds = ids(page, 'data-race-id')
      expect(raceIds, b.path).toEqual([presidentialRace().id, ...b.senate, ...b.house])
      const sections = page.split('<section class="race"').slice(1)
      for (const [i, sec] of sections.entries()) {
        const r = race(raceIds[i])
        const cands = ids(sec, 'data-candidate-id')
        expect(cands, r.id).toEqual([...r.candidates].sort((a, z) => a.ballot_position - z.ballot_position).map(c => c.id))
        for (const c of cands) {
          if (!seen.has(c)) seen.set(c, new Set())
          seen.get(c)!.add(r.id)
        }
      }
    }
    // every candidate appears, and only ever under their own race
    const expected = races().flatMap(r => r.candidates)
    expect(seen.size).toBe(expected.length)
    for (const c of expected) expect([...seen.get(c.id)!]).toEqual([c.race_id])
  })

  it('every candidate cites INEC with a link and a retrieval date', () => {
    for (const b of all.slice(0, 60)) {
      const blocks = html(b.path.slice(1)).match(/<li class="candidate"[\s\S]*?<\/li>/g)!
      for (const block of blocks) {
        expect(block).toMatch(/<p class="cite" data-source="[^"]+"><a href="https:\/\/www\.inecnigeria\.org\/documents\/[^"]+#page=\d+">Source, page \d+, row \d+: INEC: [^<]+, retrieved <time/)
        expect(block).toMatch(/<time dateTime="\d{4}-\d{2}-\d{2}">/)
      }
    }
  })

  it('unresolved ballots show every possible race, the plain note and INEC’s tools', () => {
    const unresolved = all.filter(b => b.unresolved)
    expect(unresolved.length).toBeGreaterThan(0)
    for (const b of unresolved) {
      const page = html(b.path.slice(1))
      expect(page).toContain('one of these is on your ballot')
      expect(page).toContain('INEC has not published which of these')
      expect(page).toContain('href="https://cvr.inecnigeria.org/pu"')
    }
    expect(unresolved.map(b => b.path)).toContain('/ballot/adamawa/gombi-hong--adamawa-central-or-adamawa-north-or-adamawa-south/')
  })

  it('inferred and unconfirmed placements are labelled with INEC’s text', () => {
    const want: [string, string][] = [
      ['jan-2027-house-edo-esan-central-esan-south-igueben', 'Inferred placement: ESAN WEST LGA.'],
      ['jan-2027-house-jigawa-hadejia-kafin-hausa-auyo', 'Inferred placement: AUYO LGA.'],
      ['jan-2027-senate-niger-niger-south', 'Inferred placement: GBAKO LGA.'],
      ['jan-2027-senate-kaduna-kaduna-south', 'Inferred placement: KAURU LGA.'],
      ['jan-2027-senate-adamawa-adamawa-central', 'Unconfirmed placement: HONG LGA.'],
    ]
    for (const [raceId, label] of want) {
      const b = all.find(x => x.house.includes(raceId) || x.senate.includes(raceId))!
      const page = html(b.path.slice(1))
      expect(page, raceId).toContain(label)
      expect(page).toContain('INEC’s text (row')
    }
  })

  it('printing errors are shown as printed with the neutral note', () => {
    const oyo = all.find(b => b.house.includes('jan-2027-house-oyo-oluyole'))!
    expect(html(oyo.path.slice(1))).toMatch(/947<span class="printing-note"> \(As printed in INEC’s list; this appears to be an error\.\)/)
    expect(html(all[0].path.slice(1))).toMatch(/>C<span class="printing-note"> \(As printed in INEC’s list; this appears to be an error\.\)/)
  })

  it('Niger’s House races carry the 12 September note, and no other state’s do', () => {
    for (const b of all) {
      const page = html(b.path.slice(1))
      expect(page.includes('Latest INEC list for this state: 12 September 2026'), b.path).toBe(b.state.name === 'NIGER')
    }
  })
})

describe('citations beyond candidate blocks', () => {
  const dated = (s: string, id: string) => new RegExp(`<p class="cite" data-source="${id}"><a href="https://[^"]+">[^<]+, retrieved <time dateTime="\\d{4}-\\d{2}-\\d{2}">`).test(s)

  it('every state, LGA and ward page cites INEC’s polling-unit locator with a date', () => {
    for (const s of states()) {
      expect(dated(html(`state/${s.code}`), 'inec-pu-locator'), s.name).toBe(true)
      for (const l of stateGeo(s.code).lgas) {
        expect(dated(html(`lga/${l.code.replace('/', '-')}`), 'inec-pu-locator'), l.code).toBe(true)
        for (const w of l.wards) expect(dated(html(`ward/${w.code.replaceAll('/', '-')}`), 'inec-pu-locator'), w.code).toBe(true)
      }
    }
  })

  it('every race cites INEC’s party register for the full party names, and every ballot cites how it was matched', () => {
    for (const b of ballots()) {
      const page = html(b.path.slice(1))
      const sections = page.split('<section class="race"').slice(1)
      for (const sec of sections) expect(dated(sec, 'inec-parties'), b.path).toBe(true)
      expect(dated(page, 'inec-pu-locator') && dated(page, 'inec-constituencies-workbook'), b.path).toBe(true)
    }
  })

  it('the footer dates every source on every page', () => {
    for (const f of [...walk(OUT)].filter(x => x.endsWith('.html'))) {
      const footer = fs.readFileSync(f, 'utf8').split('<footer')[1] ?? ''
      for (const id of ['president', 'inec-pu-locator', 'inec-constituencies-workbook', 'inec-parties']) expect(dated(footer, id), `${f} ${id}`).toBe(true)
    }
  })

  it('real data: an exact polling-unit name is found first (OHAFOR OHAFIA, review 2)', async () => {
    const { searchLga } = await import('@/lib/core')
    const data = JSON.parse(fs.readFileSync(path.join(OUT, 'data/pu/01.json'), 'utf8')) as StateSearchData
    expect(searchLga(data, '10', 'OHAFOR OHAFIA')[0].code).toBe('01/10/08/008')
  })
})

describe('every page', () => {
  const pages = [...walk(OUT)].filter(f => f.endsWith('.html'))

  it('carries the INEC non-affiliation notice, loads no framework JS and no third-party resource', () => {
    expect(pages.length).toBeGreaterThan(10_000)
    for (const f of pages) {
      const s = fs.readFileSync(f, 'utf8')
      expect(s, f).toContain('Not affiliated with INEC.')
      const scripts = [...s.matchAll(/<script\b[^>]*>/g)].map(m => m[0])
      expect(scripts.every(t => t === '<script type="module" src="/lookup.js">' || t === '<script type="application/ld+json">'), f).toBe(true)
      // only links (a href) and the canonical address may point off-site; nothing the page loads may
      for (const m of s.matchAll(/<(?:link|img|script|iframe|source)\b[^>]*\b(?:href|src)="([^"]+)"/g)) {
        if (m[0].startsWith('<link rel="canonical"')) continue
        expect(m[1].startsWith('/'), `${f}: ${m[1]}`).toBe(true)
      }
      expect(s).not.toMatch(/\sstyle="/)
    }
  })

  it('stylesheets contain no party names, no party-keyed selectors and only greys', () => {
    const css = [...walk(path.join(OUT, '_next'))].filter(f => f.endsWith('.css')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
    const parties = [...new Set(races().flatMap(r => r.candidates.map(c => c.party)))]
    for (const p of parties) expect(css).not.toMatch(new RegExp(`[.#\\[]${p.toLowerCase()}\\b`))
    expect(css).not.toMatch(/data-party/)
    for (const [, hex] of css.matchAll(/#([0-9a-f]{6})\b/gi)) {
      const [r, g, b] = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
      expect(r === g && g === b, `#${hex} is not grey`).toBe(true)
    }
  })
})
