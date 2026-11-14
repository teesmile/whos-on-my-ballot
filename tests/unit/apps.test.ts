import { describe, expect, it } from 'vitest'

import { appLinks, appMessage } from '@/lib/site'

describe('the "Share on" row (owner, 14 Nov 2026)', () => {
  const url = 'https://whosonmyballot.ng/race/jan-2027-senate-lagos-lagos-central/'
  const message = appMessage('Senate: LAGOS CENTRAL', '16 January 2027')
  it('one short message on every app: the site, the race and its date, then the race\'s own page', () => {
    expect(message).toBe('Who’s on my ballot? Senate: LAGOS CENTRAL, 16 January 2027. See every candidate:')
    expect(appMessage('President', '16 January 2027')).toBe('Who’s on my ballot? President, 16 January 2027. See every candidate:')
  })
  it('plain links into each app\'s own share page, nothing else', () => {
    const l = appLinks(message, url)
    expect(decodeURIComponent(l.whatsapp)).toBe(`https://wa.me/?text=${message}\n${url}`)
    const x = new URL(l.x)
    expect(`${x.origin}${x.pathname}`).toBe('https://x.com/intent/post')
    expect(x.searchParams.get('text')).toBe(message)
    expect(x.searchParams.get('url')).toBe(url)
    const fb = new URL(l.facebook)
    expect(`${fb.origin}${fb.pathname}`).toBe('https://www.facebook.com/sharer/sharer.php')
    expect([...fb.searchParams.keys()]).toEqual(['u'])
    expect(fb.searchParams.get('u')).toBe(url)
  })
})
