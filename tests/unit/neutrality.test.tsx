import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RaceSection } from '@/components/RaceSection'
import { firstGroup, races, sprite } from '@/lib/data'

/** Replace every text node and attribute value with a placeholder, keeping tags and attribute names. */
function skeleton(html: string): string {
  return html.replace(/>[^<]*</g, '><').replace(/="[^"]*"/g, '=""')
}

describe('neutral rendering', () => {
  const all = races()
  const pres = all.find(r => r.office === 'president')!

  it('every candidate card has the same structure, whatever the party', () => {
    for (const r of all.filter(x => x.office === 'house').slice(0, 40)) {
      const html = renderToStaticMarkup(<RaceSection r={r} pageUrl="/x/" />)
      const blocks = html.match(/<li class="card[^"]*"[\s\S]*?<\/li>/g) ?? []
      expect(blocks.length, r.id).toBe(r.candidates.length)
      expect(new Set(blocks.map(skeleton)).size, r.id).toBe(1)
    }
    // tickets: candidate and running mate on every card. Every card has one photo slot in the same place: an approved photo
    // (presidential candidates only, D-065) or the same placeholder; nothing else differs.
    const html = renderToStaticMarkup(<RaceSection r={pres} pageUrl="/x/" />)
    const named = html.match(/<li class="card" [^>]*data-group="(first|rest)"[\s\S]*?<\/li>/g) ?? []
    expect(named.length).toBe(pres.candidates.filter(c => c.candidate.name).length)
    const slot = (b: string) => b.replace(/<svg class="photo"[\s\S]*?<\/svg>|<span class="photo ph" aria-hidden="true"><\/span>/, 'PHOTO')
    for (const b of named) expect(slot(b).match(/PHOTO/g)?.length, b.slice(0, 80)).toBe(1)
    expect(new Set(named.map(b => skeleton(slot(b)))).size).toBe(1)
  })

  it('every card shows its party’s INEC logo from the one sprite, at the same size, with the acronym as its text', () => {
    const s = sprite()
    for (const r of [pres, ...all.filter(x => x.office === 'senate').slice(0, 20)]) {
      const html = renderToStaticMarkup(<RaceSection r={r} pageUrl="/x/" />)
      const logos = [...html.matchAll(/<svg class="logo" width="48" height="48" viewBox="(\d+) 1 94 94" focusable="false" role="img" aria-label="([A-Z]+)"><image href="([^"]+)"/g)]
      expect(logos.map(m => m[2]), r.id).toEqual(r.candidates.map(c => c.party))
      for (const m of logos) {
        expect(Number(m[1])).toBe(s.logos[m[2]] * s.cell + 1)
        expect(m[3]).toBe(`/${s.file}`)
      }
    }
  })

  it('the WhatsApp tile fills the empty slot beside an odd first group, else is a full row under it', () => {
    for (const r of [pres, ...all.slice(0, 80)]) {
      const html = renderToStaticMarkup(<RaceSection r={r} pageUrl="/x/" />)
      const first = r.candidates.filter(c => c.display_group === 'first').length
      expect((html.match(/data-wa-tile/g) ?? []).length, r.id).toBe(1)
      if (first % 2 === 1) expect(html, r.id).toMatch(/<li class="wa-tile" data-wa-tile="true">/)
      else expect(html, r.id).toMatch(/<div class="wa-tile wa-row" data-wa-tile="true">/)
    }
  })

  it('shuffling party names changes no markup structure', () => {
    const shuffled = { ...pres, candidates: pres.candidates.map((c, i, arr) => ({ ...c, party: arr[(i + 7) % arr.length].party, party_name: arr[(i + 7) % arr.length].party_name })) }
    expect(skeleton(renderToStaticMarkup(<RaceSection r={shuffled} pageUrl="/x/" />))).toBe(skeleton(renderToStaticMarkup(<RaceSection r={pres} pageUrl="/x/" />)))
  })

  it('renders the first group (D-042) alphabetically, then all other parties in ballot order, each group labelled', () => {
    const fg = firstGroup()
    for (const r of [pres, ...all.slice(0, 60)]) {
      const html = renderToStaticMarkup(<RaceSection r={r} pageUrl="/x/" />)
      const ids = [...html.matchAll(/data-candidate-id="([^"]+)"/g)].map(m => m[1])
      const first = r.candidates.filter(c => fg.parties.includes(c.party)).sort((a, b) => a.party.localeCompare(b.party))
      const rest = r.candidates.filter(c => !fg.parties.includes(c.party)).sort((a, b) => a.ballot_position - b.ballot_position)
      expect(ids, r.id).toEqual([...first, ...rest].map(c => c.id))
      if (first.length) expect(html).toContain(`>${fg.label}</h3>`)
      if (rest.length) expect(html).toContain('>All other parties, in ballot order</h3>')
    }
  })

  it('no inline styles or party-keyed classes', () => {
    const html = renderToStaticMarkup(<RaceSection r={pres} pageUrl="/x/" />)
    expect(html).not.toMatch(/style="/)
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(' ')))
    for (const c of pres.candidates) expect(classes.has(c.party.toLowerCase())).toBe(false)
  })
})
