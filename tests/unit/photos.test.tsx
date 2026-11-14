import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CandidateCard } from '@/components/Candidate'
import { races } from '@/lib/data'

// One Senate candidate is given an approved photo with an on-demand card copy (D-071); everything else is the real data.
const fake = vi.hoisted(() => ({ id: '' }))
vi.mock('@/lib/data', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data')>()
  return {
    ...real,
    photo: (id: string) => id === fake.id
      ? { page: 'photos/x.webp', page_size: 320, share: 'photos/x-share.jpg', share_size: 720, source: 'Wikimedia Commons', file_page: 'https://commons.wikimedia.org/', retrieved: '2026-11-14', approved: '2026-11-14', card: `photos/${id}-card.webp`, card_bytes: 3000 }
      : real.photo(id),
  }
})

describe('photos in races a ballot page does not show first (D-071)', () => {
  const senate = races().find(r => r.office === 'senate')!
  fake.id = senate.candidates[0].id

  it('a Senate card with an approved photo loads its own small file lazily, in the same slot and size', () => {
    const html = renderToStaticMarkup(<CandidateCard c={senate.candidates[0]} mateLabel={null} />)
    expect(html).toContain(`<img class="photo" src="/photos/${fake.id}-card.webp" width="76" height="76" alt="" loading="lazy" decoding="async"/>`)
    expect(html).not.toContain('<svg class="photo"')
  })

  it('a Senate card without one keeps the same placeholder; President cards still draw from the page image', () => {
    expect(renderToStaticMarkup(<CandidateCard c={senate.candidates[1]} mateLabel={null} />)).toContain('<span class="photo ph" aria-hidden="true"></span>')
    const pres = races().find(r => r.office === 'president')!
    const withPhoto = pres.candidates.map(c => renderToStaticMarkup(<CandidateCard c={c} mateLabel={null} />)).filter(h => h.includes('class="photo"') && !h.includes('photo ph'))
    expect(withPhoto.length).toBeGreaterThan(0)
    for (const h of withPhoto) expect(h).toContain('<svg class="photo"')
  })
})
