/** Phase 3 checks over the built site: candidate pages, links, headings, corrections, share cards and Open Graph tags. */
import fs from 'node:fs'
import path from 'node:path'

import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'

import { allCandidates, allRaces } from '@/lib/data'
import { candidatePath, CORRECTIONS_EMAIL, SITE_URL } from '@/lib/site'

const OUT = path.resolve('out')
const page = (p: string) => fs.readFileSync(path.join(OUT, p, 'index.html'), 'utf8')

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

describe('candidate pages', () => {
  const all = allCandidates()

  it('every candidate has exactly one page, and nothing else is under /c/', () => {
    for (const { c } of all) expect(fs.existsSync(path.join(OUT, candidatePath(c.id), 'index.html')), c.id).toBe(true)
    expect(fs.readdirSync(path.join(OUT, 'c')).length).toBe(all.length)
  })

  it('pages for the same office have the identical list of headings (names aside)', () => {
    const shape = (html: string) => [...html.matchAll(/<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/g)]
      .map(([, tag, text]) => `${tag}:${text.replace(/<[^>]+>/g, '').split(':')[0].trim()}`)
      .filter(h => !h.startsWith('h1:')) // the h1 is the candidate's own name
    for (const office of ['president', 'senate', 'house', 'governor', 'state_assembly']) {
      const shapes = new Set(all.filter(({ race }) => race.office === office).map(({ c }) => shape(page(candidatePath(c.id))).join('|')))
      expect(shapes.size, office).toBe(1)
    }
  })

  it('every candidate page has a pre-filled correction link and the corrections log link', () => {
    for (const { c } of all) {
      const html = page(candidatePath(c.id))
      const m = /href="(mailto:[^"]+)"/.exec(html)
      expect(m, c.id).not.toBeNull()
      const mail = new URL(m![1].replaceAll('&amp;', '&'))
      expect(mail.pathname).toBe(CORRECTIONS_EMAIL)
      expect(mail.searchParams.get('subject')).toBe(`Correction: ${c.id}`)
      expect(mail.searchParams.get('body')).toContain(`${SITE_URL}${candidatePath(c.id)}`)
      expect(html).toContain('href="/corrections/"')
    }
  })

  it('candidate pages carry Open Graph tags pointing at their race card', () => {
    for (const { race, c } of all.filter((_, i) => i % 50 === 0)) {
      const html = page(candidatePath(c.id))
      expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/cards/${race.id}.png"/>`)
      expect(html).toContain('<meta property="og:image:width" content="1200"/>')
      expect(html).toContain(`<meta property="og:url" content="${SITE_URL}${candidatePath(c.id)}"/>`)
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>')
    }
  })
})

describe('presidential background (D-013)', () => {
  const pres = allCandidates().filter(({ race }) => race.office === 'president')

  it('every presidential page shows the Background section with the same two fields for candidate and running mate', () => {
    for (const { c } of pres) {
      const html = page(candidatePath(c.id))
      expect(html, c.id).toContain('<h2 id="background">Background</h2>')
      expect((html.match(/<h4>Public offices held<\/h4>/g) ?? []).length, c.id).toBe(2)
      expect((html.match(/<h4>Party history<\/h4>/g) ?? []).length, c.id).toBe(2)
    }
  })

  it('no other race shows background, and Wikipedia is never linked anywhere', () => {
    for (const { c } of allCandidates().filter(({ race }) => race.office !== 'president').slice(0, 300)) {
      expect(page(candidatePath(c.id))).not.toContain('id="background"')
    }
    for (const f of [...walk(OUT)].filter(x => x.endsWith('.html'))) expect(fs.readFileSync(f, 'utf8')).not.toMatch(/wikipedia\.org/i)
  })
})

describe('links', () => {
  it('every internal link on every page resolves to a built file (no broken links)', () => {
    const broken: string[] = []
    const exists = new Map<string, boolean>()
    for (const f of [...walk(OUT)].filter(x => x.endsWith('.html'))) {
      for (const [, href] of fs.readFileSync(f, 'utf8').matchAll(/href="(\/[^"#]*)/g)) {
        if (!exists.has(href)) {
          const target = path.join(OUT, href)
          exists.set(href, fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, 'index.html'))))
        }
        if (!exists.get(href)) broken.push(`${path.relative(OUT, f)} -> ${href}`)
      }
    }
    expect(broken.slice(0, 10)).toEqual([])
  })
})

describe('ballot previews', () => {
  it('unresolved ballots preview the presidential card; others their House race', () => {
    const surulere = page('ballot/lagos/surulere-i-or-surulere-ii--lagos-central')
    expect(surulere).toContain(`<meta property="og:image" content="${SITE_URL}/cards/jan-2027-president.png"/>`)
    const aba = page('ballot/abia/aba-north-aba-south--abia-south')
    expect(aba).toContain(`<meta property="og:image" content="${SITE_URL}/cards/jan-2027-house-abia-aba-north-aba-south.png"/>`)
  })
})

describe('share cards', () => {
  const decode = (id: string) => PNG.sync.read(fs.readFileSync(path.join(OUT, 'cards', `${id}.png`)))

  it('one 1200x630 card per race', () => {
    for (const r of allRaces()) {
      const png = decode(r.id)
      expect([png.width, png.height], r.id).toEqual([1200, 630])
    }
    expect(fs.readdirSync(path.join(OUT, 'cards')).length).toBe(allRaces().length)
  })

  it('cards use greys only: every pixel has equal red, green and blue', () => {
    for (const r of allRaces()) {
      const { data } = decode(r.id)
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i] - data[i + 1]) > 1 || Math.abs(data[i + 1] - data[i + 2]) > 1) {
          throw new Error(`${r.id}: non-grey pixel rgb(${data[i]},${data[i + 1]},${data[i + 2]}) at ${i / 4}`)
        }
      }
    }
  })

  // Visual regression: the largest race, the longest name, the longest race name and the presidential card.
  // Update deliberately with UPDATE_CARD_SNAPSHOTS=1 after looking at the new images.
  const SNAPSHOTS = ['jan-2027-president', 'jan-2027-house-fct-municipal-bwari', 'jan-2027-house-lagos-eti-osa',
    'jan-2027-house-osun-atakunmosa-east-atakunmosa-west-ilesha-east-ilesha-west', 'jan-2027-house-kwara-ilorin-east-ilorin-south',
    'jan-2027-house-niger-chanchaga', 'feb-2027-governor-taraba', 'feb-2027-sha-kwara-kaiama-wajibe-kemanji-kaiama-ii',
    'feb-2027-sha-lagos-lagos-island-i']
  for (const id of SNAPSHOTS) {
    it(`card matches its reviewed snapshot: ${id}`, () => {
      const fixture = path.resolve('tests/fixtures/cards', `${id}.png`)
      const built = path.join(OUT, 'cards', `${id}.png`)
      if (process.env.UPDATE_CARD_SNAPSHOTS || !fs.existsSync(fixture)) fs.copyFileSync(built, fixture)
      const a = PNG.sync.read(fs.readFileSync(fixture)).data
      const b = PNG.sync.read(fs.readFileSync(built)).data
      let differing = 0
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 8) differing++
      expect(differing / (a.length / 4)).toBeLessThan(0.001)
    })
  }
})
