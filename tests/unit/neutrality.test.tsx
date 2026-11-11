import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RaceSection } from '@/components/RaceSection'
import { firstGroup, races } from '@/lib/data'

/** Replace every text node and attribute value with a placeholder, keeping tags and attribute names. */
function skeleton(html: string): string {
  return html.replace(/>[^<]*</g, '><').replace(/="[^"]*"/g, '=""')
}

describe('neutral rendering', () => {
  const all = races()
  const pres = all.find(r => r.office === 'president')!

  it('every candidate card has the same structure, whatever the party', () => {
    for (const r of all.filter(x => x.office === 'house').slice(0, 40)) {
      const html = renderToStaticMarkup(<RaceSection r={r} shareUrl="/x/" />)
      const blocks = html.match(/<li class="card[^"]*"[\s\S]*?<\/li>/g) ?? []
      expect(blocks.length, r.id).toBe(r.candidates.length)
      expect(new Set(blocks.map(skeleton)).size, r.id).toBe(1)
    }
    // tickets: candidate and running mate on every card
    const html = renderToStaticMarkup(<RaceSection r={pres} shareUrl="/x/" />)
    const named = (html.match(/<li class="card"[\s\S]*?<\/li>/g) ?? []).map(skeleton)
    expect(named.length).toBe(pres.candidates.filter(c => c.candidate.name).length)
    expect(new Set(named).size).toBe(1)
  })

  it('every card shows its party’s INEC logo at the same size, with the acronym as its text', () => {
    for (const r of [pres, ...all.filter(x => x.office === 'senate').slice(0, 20)]) {
      const html = renderToStaticMarkup(<RaceSection r={r} shareUrl="/x/" />)
      const logos = [...html.matchAll(/<img class="logo" src="\/logos\/([a-z]+)\.webp" alt="([A-Z]+)" width="48" height="48"/g)]
      expect(logos.map(m => m[2]), r.id).toEqual(r.candidates.map(c => c.party))
      for (const m of logos) expect(m[1]).toBe(m[2].toLowerCase())
    }
  })

  it('shuffling party names changes no markup structure', () => {
    const shuffled = { ...pres, candidates: pres.candidates.map((c, i, arr) => ({ ...c, party: arr[(i + 7) % arr.length].party, party_name: arr[(i + 7) % arr.length].party_name })) }
    expect(skeleton(renderToStaticMarkup(<RaceSection r={shuffled} shareUrl="/x/" />))).toBe(skeleton(renderToStaticMarkup(<RaceSection r={pres} shareUrl="/x/" />)))
  })

  it('renders the first group (D-042) alphabetically, then all other parties in ballot order, each group labelled', () => {
    const fg = firstGroup()
    for (const r of [pres, ...all.slice(0, 60)]) {
      const html = renderToStaticMarkup(<RaceSection r={r} shareUrl="/x/" />)
      const ids = [...html.matchAll(/data-candidate-id="([^"]+)"/g)].map(m => m[1])
      const first = r.candidates.filter(c => fg.parties.includes(c.party)).sort((a, b) => a.party.localeCompare(b.party))
      const rest = r.candidates.filter(c => !fg.parties.includes(c.party)).sort((a, b) => a.ballot_position - b.ballot_position)
      expect(ids, r.id).toEqual([...first, ...rest].map(c => c.id))
      if (first.length) expect(html).toContain(`>${fg.label}</h3>`)
      if (rest.length) expect(html).toContain('>All other parties, in ballot order</h3>')
    }
  })

  it('no inline styles or party-keyed classes', () => {
    const html = renderToStaticMarkup(<RaceSection r={pres} shareUrl="/x/" />)
    expect(html).not.toMatch(/style="/)
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(' ')))
    for (const c of pres.candidates) expect(classes.has(c.party.toLowerCase())).toBe(false)
  })
})
