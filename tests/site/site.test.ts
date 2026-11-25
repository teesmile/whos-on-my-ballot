/**
 * Checks over the built site in out/ (run `pnpm build` first). They read the real HTML and JSON files the
 * browser would get, and compare them with the pipeline's data.
 */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { findByCode, puHash, slug, type StateSearchData } from '@/lib/core'
import { ballots, febBallots, febRaces, presidentialRace, race, races, stateGeo, states, wardBallotPath } from '@/lib/data'

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

/** A candidate page's INEC source, named once at the top of its Sources list: INEC's list, the page and row, the retrieval date. */
const INEC_SOURCE = /<li data-source="[^"]+"><a class="src-link" href="https:\/\/www\.inecnigeria\.org\/documents\/[^"]+#page=\d+"><span><span class="src-label">The details above: <\/span><strong>INEC<\/strong>: [^<]+, page \d+, row \d+\. Retrieved <time dateTime="\d{4}-\d{2}-\d{2}">/
/** The warm accent (D-049) and its dark ink, the only colours besides greys and the national green. */
const ACCENT = ['#f0d49e', '#6e4f12']

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

  it('shows exactly its races, and each race exactly its candidates, first group then ballot order (D-042)', () => {
    const seen = new Map<string, Set<string>>()
    for (const b of all) {
      const page = html(b.path.slice(1))
      const raceIds = ids(page, 'data-race-id')
      expect(raceIds, b.path).toEqual([presidentialRace().id, ...b.senate, ...b.house])
      const sections = page.split('<section class="race"').slice(1)
      for (const [i, sec] of sections.entries()) {
        const r = race(raceIds[i])
        const cands = ids(sec, 'data-candidate-id')
        expect(cands, r.id).toEqual(r.candidates.map(c => c.id))
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

  it('every card opens its candidate’s page, and that page cites INEC with a link, page, row and retrieval date', () => {
    for (const b of all.slice(0, 60)) {
      const blocks = html(b.path.slice(1)).match(/<li class="card[^"]*"[\s\S]*?<\/li>/g)!
      for (const block of blocks) {
        const id = /data-candidate-id="([^"]+)"/.exec(block)![1]
        expect(block).toContain(`<a href="/c/${id}/">`)
      }
    }
    for (const r of races()) {
      for (const c of r.candidates.filter((_, i) => i % 7 === 0)) {
        const page = html(`c/${c.id}`)
        expect(page, c.id).toMatch(INEC_SOURCE)
      }
    }
  })

  it('every card carries its party’s logo from INEC’s register, all from one sprite served from our own origin (D-043)', () => {
    const manifest = JSON.parse(fs.readFileSync('data/generated/logos.json', 'utf8')) as Record<string, { full: string, source_url: string }>
    const sprite = JSON.parse(fs.readFileSync('data/generated/sprite.json', 'utf8')) as { file: string, cell: number, logos: Record<string, number> }
    expect(fs.existsSync(path.join(OUT, sprite.file))).toBe(true)
    expect(sprite.file).toMatch(/^logos\/sprite-[0-9a-f]{10}\.webp$/)
    for (const [party, m] of Object.entries(manifest)) {
      expect(fs.existsSync(path.join(OUT, m.full)), party).toBe(true)
      expect(sprite.logos[party], party).toBeGreaterThanOrEqual(0)
      expect(m.source_url.startsWith('https://www.inecnigeria.org/_nuxt/') || m.source_url === 'embedded in the /parties page', party).toBe(true)
    }
    for (const b of all.filter((_, i) => i % 15 === 0)) {
      const page = html(b.path.slice(1))
      expect(new Set([...page.matchAll(/<image href="([^"]+)"/g)].map(m => m[1])), b.path).toEqual(new Set([`/${sprite.file}`]))
      // logos never come as separate images; the only <img> is a card's own lazy photo: Senate, House and Assembly (D-071), and
      // any candidate outside the first five (D-081)
      for (const img of page.match(/<img [^>]*>/g) ?? []) expect(img, b.path).toMatch(/^<img class="photo" src="\/photos\/[^"]+-card\.webp" width="76" height="76" alt="" loading="lazy"/)
      for (const block of page.match(/<li class="card[^"]*"[\s\S]*?<\/li>/g)!) {
        const party = /data-party="([^"]+)"/.exec(block)![1]
        expect(block, b.path).toContain(`<svg class="logo" width="48" height="48" viewBox="${sprite.logos[party] * sprite.cell + 1} 1 94 94" focusable="false" role="img" aria-label="${party}">`)
      }
    }
  })

  it('races are tabs: one panel per office, each but the last ending in a button to the next', () => {
    for (const b of all.filter((_, i) => i % 25 === 0)) {
      const page = html(b.path.slice(1))
      expect(ids(page, 'data-tab'), b.path).toEqual(['president', 'senate', 'house'])
      expect(ids(page, 'data-panel'), b.path).toEqual(['president', 'senate', 'house'])
      expect(page).toContain('>Next: Senate</a>')
      expect(page).toContain('>Next: House of Representatives</a>')
    }
  })

  it('share blocks send the home page, so whoever opens it picks their own place; Copy link copies this page, never a polling unit', () => {
    for (const b of all.filter((_, i) => i % 25 === 0)) {
      const page = html(b.path.slice(1))
      for (const m of page.matchAll(/data-share="([^"]+)"/g)) {
        const d = JSON.parse(m[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#x27;', '\'')) as { text: string, url: string }
        expect(d.url).toBe('https://whosonmyballot.ng/')
        expect(d.text).toBe('Check who is on your ballot:')
      }
      for (const [, copy] of page.matchAll(/data-copy="([^"]+)"/g)) expect(copy).toBe(`https://whosonmyballot.ng${b.path}`)
      expect(page).not.toMatch(/pu-\d/)
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

  it('inferred and unconfirmed placements are labelled, with the LGA name in title case (D-100)', () => {
    const want: [string, string][] = [
      ['jan-2027-house-edo-esan-central-esan-south-igueben', 'Inferred placement: Esan West LGA.'],
      ['jan-2027-house-jigawa-hadejia-kafin-hausa-auyo', 'Inferred placement: Auyo LGA.'],
      ['jan-2027-senate-niger-niger-south', 'Inferred placement: Gbako LGA.'],
      ['jan-2027-senate-kaduna-kaduna-south', 'Inferred placement: Kauru LGA.'],
      ['jan-2027-senate-adamawa-adamawa-central', 'Unconfirmed placement: Hong LGA.'],
    ]
    for (const [raceId, label] of want) {
      const b = all.find(x => x.house.includes(raceId) || x.senate.includes(raceId))!
      const page = html(b.path.slice(1))
      expect(page, raceId).toContain(label)
      expect(page).toContain('INEC’s text (row')
    }
  })

  it('printing errors are shown as printed with the neutral note, on the candidate’s page', () => {
    const noted = races().flatMap(r => r.candidates).filter(c => c.printing_notes.length)
    expect(noted.length).toBeGreaterThan(1)
    for (const c of noted) {
      for (const n of c.printing_notes) {
        const esc = n.as_printed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('&', '&amp;')
        expect(html(`c/${c.id}`), c.id).toMatch(new RegExp(`${esc}<span class="printing-note"> \\(As printed in INEC’s list; this appears to be an error\\.\\)`))
      }
    }
    expect(html(`c/${noted.find(c => c.race_id === 'jan-2027-house-oyo-oluyole')!.id}`)).toContain('947<span class="printing-note">')
  })

  it('Niger’s House races carry the 12 September note, and no other state’s do', () => {
    for (const b of all) {
      const page = html(b.path.slice(1))
      expect(page.includes('Latest INEC list for this state: 12 September 2026'), b.path).toBe(b.state.name === 'Niger')
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

  it('a ballot page shows the candidates first and its references last: no citation before “Not your polling unit?”, then one Sources section citing every race, the party register and how the ballot was matched', () => {
    const specs = [
      ...ballots().map(b => ({ path: b.path, ids: [presidentialRace().id, ...b.senate, ...b.house], workbook: true })),
      ...febBallots().map(b => ({ path: b.path, ids: [...(b.governor ? [b.governor] : []), ...b.sha], workbook: b.sha.length > 0 })),
    ]
    expect(specs.length).toBeGreaterThan(1000)
    for (const b of specs) {
      const page = html(b.path.slice(1))
      const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'))
      const button = main.indexOf('Not your polling unit? Search again')
      const end = main.indexOf('<section class="ballot-sources"')
      expect(button, b.path).toBeGreaterThan(0)
      expect(end, b.path).toBeGreaterThan(button)
      expect(main.slice(0, end), b.path).not.toContain('class="cite"')
      const sources = main.slice(end)
      expect(dated(sources, 'inec-parties') && dated(sources, 'inec-pu-locator'), b.path).toBe(true)
      expect(dated(sources, 'inec-constituencies-workbook'), b.path).toBe(b.workbook)
      for (const id of b.ids) {
        const block = sources.slice(sources.indexOf(`data-sources-of="${id}"`)).split('</div>')[0]
        for (const src of race(id).sources) expect(dated(block, src), `${b.path} ${id} ${src}`).toBe(true)
      }
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

  it('the faint map of Nigeria (owner, 15 Nov 2026): a small one in every footer, a larger one at the top of the home page; decorative, inline, a line only', () => {
    const mark = /<svg class="ng-mark (ng-mark-hero|ng-mark-foot)" viewBox="(?:-2 -2 204 167|-7 -7 714 584)" aria-hidden="true" focusable="false"><path d="M[^"]+z"(?:\/>|><\/path>)<\/svg>/g
    for (const f of pages) {
      const s = fs.readFileSync(f, 'utf8')
      if (!s.includes('<footer')) continue
      const found = [...s.matchAll(mark)].map(m => m[1])
      expect(found, f).toEqual(f === path.join(OUT, 'index.html') ? ['ng-mark-hero', 'ng-mark-foot'] : ['ng-mark-foot'])
    }
    // never the flag or the coat of arms: one outline path, no fill colour of its own
    const css = fs.readFileSync(path.resolve('src/app/globals.css'), 'utf8')
    expect(css).toMatch(/\.ng-mark path \{ fill: none; stroke: var\(--green\);/)
    expect(css).toMatch(/\.ng-mark \{ position: absolute; z-index: -1;/)
  })

  it('carries the INEC non-affiliation notice, loads no framework JS and no third-party resource', () => {
    expect(pages.length).toBeGreaterThan(10_000)
    for (const f of pages) {
      const s = fs.readFileSync(f, 'utf8')
      expect(s, f).toContain('Not affiliated with INEC.')
      const scripts = [...s.matchAll(/<script\b[^>]*>/g)].map(m => m[0])
      // our own two modules (one per page: lookup.js includes the motion fallback) and structured data
      expect(scripts.every(t => ['<script type="module" src="/lookup.js">', '<script type="module" src="/motion.js">', '<script type="application/ld+json">'].includes(t)), f).toBe(true)
      expect(scripts.filter(t => t.includes('src=')).length, f).toBe(1)
      // only links (a href) and the canonical address may point off-site; nothing the page loads may
      for (const m of s.matchAll(/<(?:link|img|script|iframe|source)\b[^>]*\b(?:href|src)="([^"]+)"/g)) {
        if (m[0].startsWith('<link rel="canonical"')) continue
        // the Updates feed's alternate link names our own address in full; a browser does not load it
        if (m[0].startsWith('<link rel="alternate" type="application/rss+xml"') && m[1] === 'https://whosonmyballot.ng/updates/feed.xml') continue
        expect(m[1].startsWith('/'), `${f}: ${m[1]}`).toBe(true)
      }
      expect(s).not.toMatch(/\sstyle="/)
    }
  })

  // D-039/D-049: neutral greys, Nigeria's national green (hue 140-170) and the one warm accent (D-049) and its dark ink.
  // Never red, blue or any other hue (the red heart in the credit is an emoji, text, not a colour in the stylesheet).
  it('stylesheets contain no party names, no party-keyed selectors, and only greys, the national green and the one accent', () => {
    const css = [...walk(path.join(OUT, '_next'))].filter(f => f.endsWith('.css')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
    const parties = [...new Set(races().flatMap(r => r.candidates.map(c => c.party)))]
    for (const p of parties) expect(css).not.toMatch(new RegExp(`[.#\\[]${p.toLowerCase()}\\b`))
    expect(css).not.toMatch(/data-party/)
    expect(css).not.toMatch(/:\s*(?:red|blue|navy|crimson|maroon|teal|cyan|aqua|purple|orange|yellow|pink)\b/i)
    expect(css).not.toMatch(/prefers-color-scheme/)
    const colours: [string, number[]][] = []
    for (const [m, hex] of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
      const h = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex
      colours.push([m, [0, 2, 4].map(i => Number.parseInt(h.slice(i, i + 2), 16))])
    }
    for (const m of css.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) colours.push([m[0], [1, 2, 3].map(i => Number(m[i]))])
    expect(colours.length).toBeGreaterThan(5)
    let greens = 0
    let accents = 0
    for (const [text, [r, g, b]] of colours) {
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max - min <= 8) continue // a neutral grey
      if (ACCENT.includes(text.toLowerCase())) {
        accents++
        continue
      }
      const hue = 60 * (max === g ? 2 + (b - r) / (max - min) : max === r ? ((g - b) / (max - min) + 6) % 6 : 4 + (r - g) / (max - min))
      expect(hue >= 140 && hue <= 170, `${text} (hue ${Math.round(hue)}) is neither grey nor the national green`).toBe(true)
      greens++
    }
    expect(greens).toBeGreaterThan(0)
    expect(accents).toBeGreaterThan(0)
  })
})

describe('results (waiting state, 11 Nov 2026)', () => {
  const page = html('results')
  it('is in the header, says when results appear, and shows no figures', () => {
    expect(page).toContain('Results will appear here from 16 January 2027.')
    expect(page).toContain('States reported:')
    expect(page).toContain('<strong>0 of 37</strong>')
    // no votes or shares: every cell waits
    expect(page).not.toMatch(/<td class="num">[^<]*\d/)
    expect(page).not.toMatch(/live count/i)
  })
  it('lists the presidential candidates in the ballot page’s order', () => {
    const pres = races().find(r => r.office === 'president')!
    const ids = [...page.matchAll(/<tr data-candidate-id="([^"]+)"/g)].map(m => m[1])
    expect(ids).toEqual(pres.candidates.map(c => c.id))
  })
  it('has a page for every governorship race, in its waiting state', () => {
    for (const r of febRaces().filter(x => x.office === 'governor')) {
      const p = html(`results/governor/${slug(r.state ?? '')}`)
      expect(p, r.id).toContain('Results will appear here from 6 February 2027.')
      expect([...p.matchAll(/<tr data-candidate-id="([^"]+)"/g)].map(m => m[1]), r.id).toEqual(r.candidates.map(c => c.id))
    }
  })
  it('every race on a ballot says when its result will appear: president and governor by date, the rest once INEC lists the winners', () => {
    for (const b of ballots().filter((_, i) => i % 40 === 0)) {
      const p = html(b.path.slice(1))
      const n = (p.match(/<section class="race"/g) ?? []).length
      // the president: the date and the results page; Senate and House: the declared winner, once INEC lists those elected
      expect((p.match(/Results for this race will appear from 16 January 2027\./g) ?? []).length, b.path).toBe(1)
      expect((p.match(/The declared winner will be shown here once INEC publishes its list of those elected\./g) ?? []).length, b.path).toBe(n - 1)
      expect((p.match(/class="btn" href="mailto:[^"]+">Report a correction<\/a>/g) ?? []).length, b.path).toBe(n)
    }
  })
})

describe('links and dates everywhere', () => {
  it('no stylesheet ever underlines a link', () => {
    const css = [...walk(path.join(OUT, '_next'))].filter(f => f.endsWith('.css')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
    expect(css).not.toMatch(/text-decoration[^;}]*underline/)
  })
  it('no page gives 2026 as an election date', () => {
    for (const f of [...walk(OUT)].filter(x => x.endsWith('.html'))) {
      const text = fs.readFileSync(f, 'utf8').replace(/<[^>]+>/g, ' ')
      expect(text, f).not.toMatch(/\b(?:election|polls?|vote|ballot)\b[^.]{0,40}\b(?:January|February) 2026\b/i)
      expect(text, f).not.toMatch(/\b(?:16 January|6 February) 2026\b/)
    }
  })
})

describe('reaching a ballot only for a place the visitor picked (owner feedback, 11 Nov 2026)', () => {
  it('no candidate page links to a ballot; each links its own race page, which exists', () => {
    for (const r of [...races(), ...febRaces()].filter((_, i) => i % 9 === 0)) {
      const c = r.candidates[0]
      const page = html(`c/${c.id}`)
      expect(page, c.id).not.toMatch(/href="\/ballot(-feb)?\//)
      expect(page, c.id).toContain(`href="/race/${r.id}/"`)
      expect(fs.existsSync(path.join(OUT, 'race', r.id, 'index.html')), r.id).toBe(true)
    }
  })
  it('every ballot asks the visitor to choose first until a polling unit is confirmed', () => {
    for (const b of ballots().filter((_, i) => i % 50 === 0)) expect(html(b.path.slice(1))).toContain('Did you choose this place?')
  })
})

describe('WhatsApp’s glyph (owner’s brand download, 11 Nov 2026)', () => {
  it('is embedded byte for byte from the files in src/assets/brand/whatsapp', () => {
    const css = [...walk(path.join(OUT, '_next'))].filter(f => f.endsWith('.css')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
    for (const name of ['Digital_Glyph_White_RGB_2026.svg', 'Digital_Glyph_Green_RGB_2026.svg']) {
      const b64 = fs.readFileSync(path.join('src/assets/brand/whatsapp', name)).toString('base64')
      expect(css, name).toContain(`data:image/svg+xml;base64,${b64}`)
    }
  })
})

describe('candidate photos (owner decisions D-064, D-065, D-071, D-090)', () => {
  const photosJson = JSON.parse(fs.readFileSync(path.resolve('data/generated/photos.json'), 'utf8')) as { people: object }
  const approved = new Set(Object.keys(photosJson.people))
  it('a photo appears only where the owner approved the face; everyone else has the same placeholder', () => {
    for (const r of [presidentialRace(), ...races().filter(x => x.office !== 'president').slice(0, 20), ...febRaces()]) {
      for (const c of r.candidates) {
        const page = html(`c/${c.id}`)
        if (approved.has(c.id)) expect(page, c.id).toMatch(/<div class="profile-photo"><img src="\/photos\/[^"]+\.webp"/)
        else expect(page, c.id).toContain('<div class="profile-photo"><span class="photo ph" aria-hidden="true"></span></div>')
      }
    }
  })
  it('a ballot page draws its logos and its first race\'s photos from one image: the President\'s on 16 January, the state\'s governorship image on 6 February', () => {
    const s = JSON.parse(fs.readFileSync(path.resolve('data/generated/sprite.json'), 'utf8')) as { file: string, logo_file: string, sheets: Record<string, { file: string }> }
    const imgs = (page: string) => new Set([...page.matchAll(/<image href="([^"]+)"/g)].map(m => m[1]))
    expect([...imgs(html('ballot/abia/aba-north-aba-south--abia-south'))]).toEqual([`/${s.file}`])
    expect([...imgs(html('ballot-feb/lagos/alimosho-i'))]).toEqual([`/${s.sheets['feb-2027-governor-lagos'].file}`])
    expect([...imgs(html('ballot-feb/yobe/bade-east'))]).toEqual([`/${s.sheets['feb-2027-governor-yobe'].file}`]) // one party's photo alone now shows (D-090)
    expect([...imgs(html('ballot-feb/osun/ayedade'))]).toEqual([`/${s.logo_file}`]) // no governorship on 6 February
    expect(html('ballot-feb/lagos/alimosho-i')).toMatch(/data-candidate-id="feb-2027-governor-lagos-apc"[\s\S]*?<svg class="photo"/)
    expect(html('ballot-feb/yobe/bade-east')).toMatch(/data-candidate-id="feb-2027-governor-yobe-apc"[\s\S]*?<svg class="photo"/)
    // a Senate photo is the card's own small copy, loaded only when its race is shown
    expect(html('ballot/kwara/ilorin-west-asa--kwara-central')).toMatch(/data-candidate-id="jan-2027-senate-kwara-kwara-central-apc"[\s\S]*?<img class="photo" src="\/photos\/jan-2027-senate-kwara-kwara-central-apc-card\.webp" width="76" height="76" alt="" loading="lazy"/)
  })
  it('no credit on the candidate page; the full credit for each photo is on its state\'s photo credits page, listed from an index linked from About (D-094)', () => {
    // every built photo is a yaml entry with the owner's approval, or an official-page or news photo checked against INEC (D-074, D-084);
    // a Commons file never goes live on the official-page route
    const entries = fs.readFileSync(path.resolve('data/overrides/photos.yaml'), 'utf8').split(/\n  - /).slice(1)
    const cleared = entries.filter(e => /\n    (owner_approved|official_checked|news_checked): '\d{4}-\d{2}-\d{2}'/.test(e)).map(e => /^candidate_id: (\S+)/.exec(e)![1])
    // every cleared photo shows, for every party (D-090: no per-race rule)
    expect([...approved].sort()).toEqual(cleared.sort())
    for (const e of entries.filter(x => /\n    official_checked:/.test(x))) expect(e, e.slice(0, 80)).not.toMatch(/Wikimedia Commons|wikimedia\.org/)
    const about = html('about')
    expect(about).toMatch(/<h2 id="photo-credits">Photo credits<\/h2>[\s\S]*?<a href="\/about\/photo-credits\/">the photo credits pages<\/a>/)
    expect(about).not.toContain('<li id="credit-')
    const index = html('about/photo-credits')
    const groups = [...index.matchAll(/<a href="\/about\/photo-credits\/([a-z0-9-]+)\/">/g)].map(m => m[1])
    expect(groups[0]).toBe('president')
    expect(groups.length).toBeGreaterThan(30)
    const all = groups.map(g => html(`about/photo-credits/${g}`)).join('\n')
    for (const id of approved) {
      const page = html(`c/${id}`)
      expect(page, id).toMatch(/<div class="profile-photo"><img src="\/photos\/[^"]+\.webp" width="160" height="160" alt="Photo of [^"]+"\/><\/div>/)
      expect(page, id).not.toMatch(/figcaption|CC BY|CC0|Wikimedia|Photo: /)
      expect(all, id).toContain(`<li id="credit-${id}">`)
    }
    expect([...all.matchAll(/<li id="credit-/g)].length).toBe(approved.size) // each credit once
    for (const m of all.matchAll(/<li id="credit-[^"]+">([\s\S]*?)<\/li>/g)) expect(m[1]).toMatch(/<a href="https?:\/\/[^"]+">[^<]+<\/a>[\s\S]*cropped to a square[\s\S]*Retrieved/)
  })
  it('every approved photo shows, for every party, first five or not; no race is held back (D-090)', () => {
    expect(fs.existsSync(path.resolve('data/overrides/governing-party.yaml'))).toBe(false)
    expect(Object.keys(photosJson)).toEqual(['people'])
    // a race whose only photo is one party's still shows it: the governing party's included
    expect(approved.has('feb-2027-governor-yobe-apc')).toBe(true)
    expect(html('c/feb-2027-governor-yobe-apc')).toMatch(/<div class="profile-photo"><img src="\/photos\/feb-2027-governor-yobe-apc\.webp"/)
    // a photo outside the first five is the card's own lazy copy, never part of the image a page loads first (D-081)
    const pj = photosJson.people as Record<string, { card?: string }>
    for (const r of [presidentialRace(), ...races(), ...febRaces()]) for (const c of r.candidates) if (c.display_group === 'rest' && pj[c.id]) expect(pj[c.id].card, c.id).toBeTruthy()
    const sprite = JSON.parse(fs.readFileSync(path.resolve('data/generated/sprite.json'), 'utf8')) as { photos: Record<string, number>, sheets: Record<string, { photos: Record<string, number> }> }
    const inImage = [...Object.keys(sprite.photos), ...Object.values(sprite.sheets).flatMap(sh => Object.keys(sh.photos))]
    const restIds = new Set([presidentialRace(), ...febRaces()].flatMap(r => r.candidates.filter(c => c.display_group === 'rest').map(c => c.id)))
    expect(inImage.filter(id => restIds.has(id))).toEqual([])
  })
  it('every card has the photo slot, a photo or the same placeholder, in the same place', () => {
    const ballot = html('ballot/abia/aba-north-aba-south--abia-south')
    const cards = ballot.match(/<li class="card[^"]*" [\s\S]*?<\/li>/g)!
    expect(cards.length).toBeGreaterThan(30)
    for (const c of cards) expect(c, c.slice(0, 120)).toMatch(/<span class="card-top"><span class="card-id"><svg class="logo"[\s\S]*?<\/span><\/span>(<svg class="photo"|<img class="photo" src="\/photos\/[^"]+-card\.webp" width="76" height="76" alt="" loading="lazy"|<span class="photo ph" aria-hidden="true"><\/span>)/)
  })
  it('the About page says where photos come from and that a candidate or party can send an official one', () => {
    const about = html('about')
    expect(about).toContain('<h2 id="photos">Photos</h2>')
    expect(about).toMatch(/Wikimedia Commons, the candidate’s or party’s own\s+official website or campaign directory, an official government or legislature page, a public civic database of elected\s+officials, or a news report or social media account that names the candidate with their party and their seat or state \(an account\s+only when it is clearly the candidate’s own\), or a photo the site’s owner supplied\. A photo is matched to a candidate only when the\s+source gives their full name with their seat, or with their state and office\. A photo may be from an event, a television interview or a campaign poster\. Never a photo from a picture agency or stock\s+library/)
    // framing relaxed (owner, 15 Nov 2026): a square around the face, the same size for all; no promise of a plain head-and-shoulders crop
    expect(about).toMatch(/Every photo is cropped to a square around\s+the candidate’s face and shown at the same size/)
    expect(about).not.toMatch(/head-and-shoulders/)
    expect(about).not.toMatch(/Never a news site/)
    // the photo's owner can have it taken down (owner, 15 Nov 2026)
    expect(about).toMatch(/The owner of any photo can ask for it to be removed by writing to\s*<a href="mailto:corrections@anthonyugwuja\.dev\?subject=Remove%20a%20photo">corrections@anthonyugwuja\.dev<\/a>\s*, and it comes down within a day\./)
    expect(about).toMatch(/checked against the gender and age INEC printed for the candidate\.\s+A photo from Wikimedia Commons, where anyone can upload a file,\s+is used only when the file’s description, or the Wikipedia article that carries it, names the candidate’s state and office or race\.\s+Photos are being added race by race; the source of each is listed on the photo credits pages\./)
    expect(about).not.toMatch(/approved by the site’s owner before it appears|listed at the end of this/)
    expect(about).toMatch(/A request to change a photo goes to\s*<a href="mailto:corrections@anthonyugwuja\.dev\?subject=Change%20a%20photo">/)
    // a candidate or campaign sends a photo by email (no form), with a template; the About page never explains the per-race rule
    for (const page of [about, html('corrections')]) {
      expect(page).toMatch(/<a class="btn" href="mailto:corrections@anthonyugwuja\.dev\?subject=Candidate%20photo&amp;body=Candidate%20name%2C%20as%20INEC%20lists%20it%3A[^"]*Race[^"]*Link%20to%20an%20official%20page%20or%20verified%20account[^"]*">Send a candidate’s photo<\/a>/)
      expect(page).toContain('Nothing sent this way appears by itself')
    }
    expect(about).not.toMatch(/first group have one|governing party|only once at least two/)
  })
})

describe('why the site exists (owner wording, 14 Nov 2026)', () => {
  it('no page says "non-partisan"; the About page opens with why, the home page says one line more', () => {
    for (const b of ballots().filter((_, i) => i % 40 === 0).map(x => x.path.slice(1))) expect(html(b), b).not.toMatch(/non-?partisan/i)
    for (const p of ['', 'about', 'corrections', 'election-day']) expect(html(p), p).not.toMatch(/non-?partisan/i)
    const about = html('about')
    expect(about).toMatch(/<p class="lead">\s*Most of us think only about the presidential vote\. But a president cannot govern alone\./)
    expect(about).toContain('Know who you are voting for, in every race.')
    expect(about).toContain('A free and independent guide to Nigeria’s 2027 elections.')
    const home = html('')
    expect(home).toContain('<span class="hero-why">Your vote for president is only one of them. Know every name on your ballot.</span>')
    expect(home).toContain('<meta name="description" content="Every candidate on your ballot in Nigeria’s 2027 elections, for every office, from INEC’s published lists. Know who you are voting for."/>')
    expect(home).toContain('Not affiliated with INEC.')
  })
})

describe('"Share on" WhatsApp, X, Facebook and Instagram (owner, 14 Nov 2026)', () => {
  const rowOf = (block: string) => /<div class="share-on">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ''
  const blocks = (page: string) => [...page.matchAll(/<section class="share"[^>]*data-share="([^"]*)"[^>]*>([\s\S]*?)<\/section>/g)]
    .map(m => ({ data: JSON.parse(m[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&')) as { race: string, name: string, date: string, appText: string }, html: m[2] }))
  const pages = ['ballot/abia/aba-north-aba-south--abia-south', 'ballot-feb/lagos/alimosho-i', 'race/jan-2027-president', 'c/jan-2027-senate-lagos-lagos-central-apc']
  it('every share block has the words and four icons: three plain links with the race\'s message and page, and Instagram for the page script', () => {
    let n = 0
    for (const p of pages) {
      for (const b of blocks(html(p))) {
        n++
        const row = rowOf(b.html).replaceAll('&amp;', '&')
        const url = `https://whosonmyballot.ng/race/${b.data.race}/`
        const message = `Who’s on my ballot? ${b.data.name}, ${b.data.date}. See every candidate:`
        expect(row, p).toContain('<span class="share-on-label" aria-hidden="true">Share on</span>')
        expect(row, p).toContain(`href="https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}" target="_blank" rel="noopener" aria-label="Share on WhatsApp"`)
        expect(row, p).toContain(`href="https://x.com/intent/post?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on X"`)
        expect(row, p).toContain(`href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on Facebook" data-app="facebook">`)
        expect(row, p).toMatch(/<button type="button" class="share-app" aria-label="Share on Instagram" data-app="instagram" hidden="">/)
        // the caption the pictures carry: the same message and the race's own page
        expect(b.data.appText, p).toBe(`${message}\n${url}`)
        // one square picture (owner, 15 Nov 2026, D-087): no Story or Post, no tall or square; "Save picture" waits for the page script
        expect(b.html, p).not.toMatch(/data-pick|share-pick|Story|Tall|Square/)
        expect(b.html, p).toContain('<button type="button" class="btn-quiet share-save" data-save="true" hidden="">Save picture</button>')
        // four icons, one glyph each, never the visitor's place: the race's own page, not the ballot
        expect(row.match(/class="share-app"/g)?.length, p).toBe(4)
        expect(row, p).not.toContain('/ballot')
      }
    }
    expect(n).toBeGreaterThan(5)
  })
  it('each glyph is embedded byte for byte from src/assets/brand, so the row makes no request', () => {
    const css = [...walk(path.join(OUT, '_next'))].filter(f => f.endsWith('.css')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
    for (const [dir, name, type] of [['x', 'logo-black-96.webp', 'webp'], ['facebook', 'Facebook_Logo_Primary-96.webp', 'webp'], ['instagram', 'Instagram_Glyph_Gradient-96.webp', 'webp']]) {
      const b64 = fs.readFileSync(path.join('src/assets/brand', dir, name)).toString('base64')
      expect(css, name).toContain(`data:image/${type};base64,${b64}`)
    }
  })
})

describe('updates (owner, 15 Nov 2026)', () => {
  const entries = JSON.parse(fs.readFileSync(path.resolve('data/overrides/updates.json'), 'utf8')) as { slug: string, date: string, headline: string, body: string[] }[]
  it('a list page, one indexable page per entry with its date, source and links, and a feed', () => {
    expect(entries.length).toBeGreaterThanOrEqual(2)
    const list = html('updates')
    expect(list).toContain('<h1>Updates</h1>')
    expect(list).toMatch(/<link rel="alternate" type="application\/rss\+xml"[^>]*href="(https:\/\/whosonmyballot\.ng)?\/updates\/feed\.xml"/)
    for (const u of entries) {
      expect(list, u.slug).toContain(`href="/updates/${u.slug}/"`)
      const page = html(`updates/${u.slug}`)
      expect(page, u.slug).toContain(`<link rel="canonical" href="https://whosonmyballot.ng/updates/${u.slug}/"`)
      expect(page, u.slug).toContain(`<time dateTime="${u.date}">`)
      expect(page, u.slug).toMatch(/<p class="cite"><a href="[^"]+">Source: /)
      expect(page, u.slug).toContain('"@type":"NewsArticle"')
      expect(u.body.length >= 2 && u.body.length <= 5, u.slug).toBe(true)
      expect([u.headline, ...u.body].join(' '), u.slug).not.toMatch(/[\u2013\u2014]/)
    }
    const feed = fs.readFileSync(path.join(OUT, 'updates', 'feed.xml'), 'utf8')
    expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"')).toBe(true)
    expect(feed.match(/<item>/g)?.length).toBe(entries.length)
    for (const u of entries) expect(feed, u.slug).toContain(`<link>https://whosonmyballot.ng/updates/${u.slug}/</link>`)
  })
  it('the home page has one card with the latest two entries and a button to the list; no header or footer link', () => {
    const home = html('')
    const card = /<section aria-labelledby="updates" class="panel updates-card">([\s\S]*?)<\/section>/.exec(home)![1]
    expect(card.match(/href="\/updates\/[a-z0-9-]+\/"/g)?.length).toBe(2)
    expect(card).toContain('<a class="btn" href="/updates/">All updates</a>')
    for (const page of [home, html('about'), html('updates')]) {
      const header = /<header[\s\S]*?<\/header>/.exec(page)![0]
      const footer = /<footer[\s\S]*?<\/footer>/.exec(page)![0]
      expect(header).not.toContain('/updates/')
      expect(footer).not.toContain('/updates/')
    }
    const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8')
    expect(sitemap).toContain('<loc>https://whosonmyballot.ng/updates/</loc>')
    for (const u of entries) expect(sitemap, u.slug).toContain(`<loc>https://whosonmyballot.ng/updates/${u.slug}/</loc>`)
  })
})
