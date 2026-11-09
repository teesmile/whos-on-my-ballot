import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RaceSection } from '@/components/RaceSection'
import { races } from '@/lib/data'

/** Replace every text node and attribute value with a placeholder, keeping tags and attribute names. */
function skeleton(html: string): string {
  return html.replace(/>[^<]*</g, '><').replace(/="[^"]*"/g, '=""')
}

describe('neutral rendering', () => {
  const all = races()
  const pres = all.find(r => r.office === 'president')!

  it('every candidate block has the same structure, whatever the party', () => {
    for (const r of all.filter(x => x.office === 'house').slice(0, 40)) {
      const html = renderToStaticMarkup(<RaceSection r={r} />)
      const blocks = html.match(/<li class="candidate"[\s\S]*?<\/li>/g) ?? []
      // printing notes add a span only where INEC's value is an error; strip them for the structural comparison
      const shapes = new Set(blocks.map(b => skeleton(b.replace(/<span class="printing-note">[\s\S]*?<\/span>/g, ''))))
      expect(shapes.size, r.id).toBe(1)
    }
  })

  it('shuffling party names changes no markup structure', () => {
    const shuffled = { ...pres, candidates: pres.candidates.map((c, i, arr) => ({ ...c, party: arr[(i + 7) % arr.length].party, party_name: arr[(i + 7) % arr.length].party_name })) }
    expect(skeleton(renderToStaticMarkup(<RaceSection r={shuffled} />))).toBe(skeleton(renderToStaticMarkup(<RaceSection r={pres} />)))
  })

  it('renders candidates in ballot_position order', () => {
    const html = renderToStaticMarkup(<RaceSection r={pres} />)
    const ids = [...html.matchAll(/data-candidate-id="([^"]+)"/g)].map(m => m[1])
    expect(ids).toEqual([...pres.candidates].sort((a, b) => a.ballot_position - b.ballot_position).map(c => c.id))
  })

  it('no inline styles or party-keyed classes', () => {
    const html = renderToStaticMarkup(<RaceSection r={pres} />)
    expect(html).not.toMatch(/style="/)
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(' ')))
    for (const c of pres.candidates) expect(classes.has(c.party.toLowerCase())).toBe(false)
  })
})
