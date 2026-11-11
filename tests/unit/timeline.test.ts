import { describe, expect, it } from 'vitest'

import { Refs, splitEntry, timelineOrder } from '@/components/Background'
import { CAPTION, caption } from '@/lib/share'
import { shareLinks } from '@/lib/site'

describe('career timeline: roles and dates only, words unchanged (owner feedback, 11 Nov 2026)', () => {
  it('splits the dates off an entry without changing its words', () => {
    expect(splitEntry('Governor of Anambra State, 2006-2014')).toEqual({ role: 'Governor of Anambra State', when: '2006-2014' })
    expect(splitEntry('President of Nigeria, from 2023')).toEqual({ role: 'President of Nigeria', when: 'From 2023' })
    expect(splitEntry('Presidential candidate of the Labour Party (LP), 2023 election')).toEqual({ role: 'Presidential candidate of the Labour Party (LP)', when: '2023 election' })
    expect(splitEntry('Member of the Peoples Democratic Party (PDP)')).toEqual({ role: 'Member of the Peoples Democratic Party (PDP)', when: null })
    expect(splitEntry('Chairman, Board of Trustees, Labour Party (LP)').when).toBeNull()
  })
  it('lists newest first, ongoing roles at the top, undated entries last in their recorded order', () => {
    const t = (text: string) => ({ text })
    const order = timelineOrder([t('A, 1999-2007'), t('B'), t('C, from 2023'), t('D, 2011-2015'), t('E'), t('F, 2015 election')]).map(e => e.text[0])
    expect(order).toEqual(['C', 'F', 'D', 'A', 'B', 'E'])
  })
  it('numbers each source once, in order of first use', () => {
    const r = new Refs()
    const c = (url: string) => ({ url, publisher: url, title: '', published: 'unknown', quote: '', retrieved: '2026-11-10' })
    expect([r.cite(c('a')), r.cite(c('b')), r.cite(c('a')), r.cite(c('c'))]).toEqual([1, 2, 1, 3])
  })
})

describe('share caption (owner’s wording, 11 Nov 2026)', () => {
  it('is exactly the owner’s words, then the full https address on the next line, with no year', () => {
    expect(caption()).toBe('Check who is on your ballot:')
    expect(CAPTION).not.toMatch(/20\d\d/)
    const url = 'https://whosonmyballot.ng/ballot/lagos/agege--lagos-west/#senate'
    expect(decodeURIComponent(shareLinks(caption(), url).whatsapp.replace('https://wa.me/?text=', ''))).toBe(`Check who is on your ballot:\n${url}`)
  })
})
