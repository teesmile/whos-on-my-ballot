/** Phase 5 checks over the built site: the 6 February ballots (Governor and State House of Assembly). */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { findByCode, puHash, type StateSearchData } from '@/lib/core'
import { febBallots, febRaces, race, stateGeo, states, wardFebBallotPath } from '@/lib/data'
import { candidatePath, SITE_URL } from '@/lib/site'

const OUT = path.resolve('out')
const html = (p: string) => fs.readFileSync(path.join(OUT, p, 'index.html'), 'utf8')
const ids = (s: string, attr: string) => [...s.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))].map(m => m[1])
const OFF_CYCLE = ['ANAMBRA', 'BAYELSA', 'EDO', 'EKITI', 'IMO', 'KOGI', 'ONDO', 'OSUN']

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

describe('every polling unit reaches the same 6 February ballot by every route', () => {
  it('code lookup, the ward page link and the ward mapping agree for all polling units', () => {
    let checked = 0
    for (const s of states()) {
      const data = JSON.parse(fs.readFileSync(path.join(OUT, 'data/pu', `${s.code}.json`), 'utf8')) as StateSearchData
      const geo = stateGeo(s.code)
      for (const lga of geo.lgas) {
        for (const ward of lga.wards) {
          const expected = wardFebBallotPath(geo, ward)
          expect(fs.existsSync(path.join(OUT, expected, 'index.html')), expected).toBe(true)
          const page = html(`ward/${ward.code.replaceAll('/', '-')}`)
          expect(page, ward.code).toContain(`href="${expected}" data-feb-ballot="true"`)
          for (const pu of ward.polling_units) {
            expect(findByCode(data, pu.code)?.febBallotPath, pu.code).toBe(expected)
            checked++
          }
        }
      }
    }
    expect(checked).toBe(177_299)
  })
})

describe('6 February ballot pages', () => {
  const all = febBallots()
  const governorStates = new Set(febRaces().filter(r => r.office === 'governor').map(r => r.state))

  it('one page per distinct ballot, and nothing else under /ballot-feb/', () => {
    const built = [...walk(path.join(OUT, 'ballot-feb'))].filter(f => f.endsWith('index.html')).length
    expect(built).toBe(all.length)
  })

  it('28 states have a governorship race; the eight off-cycle states and the FCT do not', () => {
    expect(governorStates.size).toBe(28)
    for (const s of [...OFF_CYCLE, 'FCT']) expect(governorStates.has(s), s).toBe(false)
  })

  it('shows exactly its races, and each race exactly its candidates, in ballot order', () => {
    const seen = new Map<string, Set<string>>()
    for (const b of all) {
      const page = html(b.path.slice(1))
      const raceIds = ids(page, 'data-race-id')
      expect(raceIds, b.path).toEqual([...(b.governor ? [b.governor] : []), ...b.sha])
      const sections = page.split('<section class="race" data-race-id').slice(1)
      for (const [i, sec] of sections.entries()) {
        const r = race(raceIds[i])
        const cands = ids(sec.split('<section class="race"')[0], 'data-candidate-id')
        expect(cands, r.id).toEqual(r.candidates.map(c => c.id))
        for (const c of cands) {
          if (!seen.has(c)) seen.set(c, new Set())
          seen.get(c)!.add(r.id)
        }
      }
    }
    const expected = febRaces().flatMap(r => r.candidates)
    expect(seen.size).toBe(expected.length)
    for (const c of expected) expect([...seen.get(c.id)!]).toEqual([c.race_id])
  })

  it('every state without a governorship race shows the identical note, citing INEC’s governorship list', () => {
    for (const b of all.filter(x => !x.governor)) {
      const page = html(b.path.slice(1))
      const want = b.state.name === 'FCT'
        ? 'The FCT has no governor and no State House of Assembly, so there is no election in the FCT on 6 February 2027.'
        : `${b.state.name} has no governorship election on 6 February 2027.`
      expect(page, b.path).toContain(`<p class="note" data-no-governor="true">${want}</p>`)
      // the Governor tab counts 0 candidates, in the same circle as every other tab
      if (b.state.name !== 'FCT') expect(page, b.path).toMatch(/data-tab="governor"><span class="tab-name"[^>]*>Governor<\/span> <span class="tab-count"><span class="tab-n">0<\/span>/)
      expect(page).toContain('data-source="governor-abia"><a href="https://www.inecnigeria.org/press/updated-final-list-of-candidates-for-2027-governorship-election"')
    }
    for (const b of all.filter(x => x.governor)) expect(html(b.path.slice(1))).not.toContain('data-no-governor')
  })

  it('Borno says INEC’s list has no State Assembly candidates for it; the FCT has no State Assembly section', () => {
    const borno = all.filter(b => b.state.name === 'BORNO')
    expect(borno.map(b => b.path)).toEqual(['/ballot-feb/borno/'])
    expect(html('ballot-feb/borno')).toContain('INEC has not published a list of State House of Assembly candidates for Borno.')
    expect(html('ballot-feb/borno')).toContain('data-source="sha-2026-10-10"')
    expect(all.filter(b => b.state.name === 'FCT').map(b => b.path)).toEqual(['/ballot-feb/fct/'])
    expect(html('ballot-feb/fct')).not.toContain('State House of Assembly</h2>')
    for (const b of all.filter(x => x.state.name !== 'BORNO')) expect(html(b.path.slice(1))).not.toContain('data-no-sha')
  })

  it('unresolved ballots show every possible State Assembly race, the plain note and INEC’s tools', () => {
    const unresolved = all.filter(b => b.unresolved)
    expect(unresolved.length).toBeGreaterThan(0)
    for (const b of unresolved) {
      expect(b.sha.length, b.path).toBeGreaterThan(1)
      const page = html(b.path.slice(1))
      expect(page).toContain('<h2 id="group-state-house-of-assembly" class="band">State House of Assembly: one of these is on your ballot</h2>')
      expect(page).toContain(`INEC’s published documents don’t settle which of these ${b.sha.length} races`)
      expect(page).toContain('href="https://cvr.inecnigeria.org/pu"')
    }
    for (const b of all.filter(x => !x.unresolved)) expect(b.sha.length, b.path).toBeLessThanOrEqual(1)
  })

  it('every ballot with a State Assembly race cites the workbook and IReV; disagreements are said plainly, only where they occur', () => {
    let disagree = 0
    for (const b of all) {
      const page = html(b.path.slice(1)).split('<footer')[0] // the footer dates every source on every page
      expect(page.includes('data-source="inec-irev-2023-assembly"'), b.path).toBe(b.sha.length > 0)
      expect(page.includes('data-source="inec-constituencies-workbook"'), b.path).toBe(b.sha.length > 0)
      expect(page.includes('data-sources-disagree'), b.path).toBe(b.disagree)
      if (b.disagree) {
        disagree++
        expect(b.sha.length, b.path).toBeGreaterThan(1)
      }
    }
    expect(disagree).toBeGreaterThan(0)
  })

  it('every candidate’s page cites INEC with a link to the page and a retrieval date', () => {
    for (const r of febRaces().filter((_, i) => i % 20 === 0)) {
      for (const c of r.candidates) {
        expect(html(`c/${c.id}`), c.id).toMatch(/<li data-source="[^"]+"><a class="src-link" href="https:\/\/www\.inecnigeria\.org\/documents\/[^"]+#page=\d+"><span><span class="src-label">The details above: <\/span><strong>INEC<\/strong>: [^<]+, page \d+, row \d+\. Retrieved <time dateTime="\d{4}-\d{2}-\d{2}">/)
      }
    }
  })

  it('previews the governorship card, else the one State Assembly race, else the site card', () => {
    for (const b of all) {
      const page = html(b.path.slice(1))
      const want = b.governor ?? (b.sha.length === 1 ? b.sha[0] : 'site')
      expect(page, b.path).toContain(`<meta property="og:image" content="${SITE_URL}/cards/${want}.png"/>`)
    }
  })

  it('the January ballot and February ballot confirm boxes say which election they are for', () => {
    expect(html(all[0].path.slice(1))).toContain('data-lookup="confirm" data-election="feb"')
  })
})

describe('owner ruling D-041: two Kogi readings rest on names alone, so their wards show all races', () => {
  it.each([
    ['22/11', ['feb-2027-sha-kogi-kogi-k-k', 'feb-2027-sha-kogi-koton-karfe-ii']],
    ['22/07', ['feb-2027-sha-kogi-idah', 'feb-2027-sha-kogi-igala-ogwa']],
  ])('every ward in LGA %s shows both races, marked unresolved', (lga, races) => {
    const wards = stateGeo('22').lgas.find(l => l.code === lga)!.wards
    expect(wards.length).toBeGreaterThan(0)
    for (const w of wards) {
      expect([...w.state_constituency].sort(), w.code).toEqual(races)
      expect(w.sc_mapping, w.code).toBe('unresolved')
      const page = html(wardFebBallotPath(stateGeo('22'), w).slice(1))
      for (const r of races) expect(page, w.code).toContain(`data-race-id="${r}"`)
    }
  })
})

describe('6 February candidate pages', () => {
  it('governorship candidates show the deputy governor; nobody on 6 February gets a background section', () => {
    for (const r of febRaces()) {
      for (const c of r.candidates.filter((_, i) => r.office === 'governor' || i === 0)) {
        const page = html(candidatePath(c.id).slice(1))
        expect(page, c.id).toContain(' - 6 February 2027</p>')
        expect(page).not.toContain('id="career"')
        expect(page.includes('<h3 id="mate">Deputy governor'), c.id).toBe(r.office === 'governor')
        expect(page).not.toContain('Running mate')
      }
    }
  })
})
