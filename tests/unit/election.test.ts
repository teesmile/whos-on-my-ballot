import { afterEach, describe, expect, it } from 'vitest'

import { describePhase, formatDay, formatDuration, formatTime, instant, phaseAt, type Schedule } from '@/lib/election'

const S: Schedule = {
  open: '08:30',
  close: '14:30',
  elections: [
    { id: 'feb-2027', date: '2027-02-06', races: 'Governor and State House of Assembly' },
    { id: 'jan-2027', date: '2027-01-16', races: 'President, Senate and House of Representatives' },
  ],
}
const at = (iso: string) => new Date(iso)
const MIN = 60_000

describe('phaseAt boundaries (WAT = UTC+1)', () => {
  it('one minute before polls open', () => {
    expect(phaseAt(at('2027-01-16T07:29:00Z'), S)).toMatchObject({ kind: 'before', next: { id: 'jan-2027' }, msToOpen: MIN })
  })
  it('exactly when polls open: voting', () => {
    expect(phaseAt(at('2027-01-16T07:30:00Z'), S)).toMatchObject({ kind: 'voting', current: { id: 'jan-2027' } })
  })
  it('one minute after polls open', () => {
    expect(phaseAt(at('2027-01-16T07:31:00Z'), S)).toMatchObject({ kind: 'voting', msToClose: (6 * 60 - 1) * MIN })
  })
  it('one minute before close: still voting', () => {
    expect(phaseAt(at('2027-01-16T13:29:00Z'), S)).toMatchObject({ kind: 'voting', msToClose: MIN })
  })
  it('exactly at close: closed to new arrivals, next is 6 February', () => {
    expect(phaseAt(at('2027-01-16T13:30:00Z'), S)).toMatchObject({ kind: 'between', closed: { id: 'jan-2027' }, next: { id: 'feb-2027' } })
  })
  it('6 February works the same way, and after it closes nothing is next', () => {
    expect(phaseAt(at('2027-02-06T07:29:59Z'), S)).toMatchObject({ kind: 'between', next: { id: 'feb-2027' } })
    expect(phaseAt(at('2027-02-06T07:30:00Z'), S)).toMatchObject({ kind: 'voting', current: { id: 'feb-2027' } })
    expect(phaseAt(at('2027-02-06T13:30:00Z'), S)).toMatchObject({ kind: 'after', closed: { id: 'feb-2027' } })
    expect(phaseAt(at('2027-12-31T00:00:00Z'), S)).toMatchObject({ kind: 'after' })
  })
  it('instants are fixed in WAT', () => {
    expect(instant('2027-01-16', '08:30').toISOString()).toBe('2027-01-16T07:30:00.000Z')
  })
})

describe('text', () => {
  it('durations round down to the minute and read naturally', () => {
    expect(formatDuration(59_999)).toBe('less than a minute')
    expect(formatDuration(MIN)).toBe('1 minute')
    expect(formatDuration(61 * MIN)).toBe('1 hour and 1 minute')
    expect(formatDuration((2 * 1440 + 3 * 60 + 4) * MIN + 59_000)).toBe('2 days, 3 hours and 4 minutes')
    expect(formatDuration(1440 * MIN)).toBe('1 day')
  })
  it('times and days', () => {
    expect(formatTime('08:30')).toBe('8:30 AM')
    expect(formatTime('14:30')).toBe('2:30 PM')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatDay('2027-01-16')).toBe('Saturday 16 January 2027')
    expect(formatDay('2027-02-06')).toBe('Saturday 6 February 2027')
  })
  it('each phase says only what INEC’s pages say', () => {
    expect(describePhase(phaseAt(at('2027-01-15T07:30:00Z'), S), S)).toEqual({
      headline: 'Polls open in 1 day.',
      details: ['Saturday 16 January 2027, 8:30 AM to 2:30 PM WAT: President, Senate and House of Representatives.'],
      showResultsLink: false,
    })
    expect(describePhase(phaseAt(at('2027-01-16T10:00:00Z'), S), S).headline).toBe('Voting is underway.')
    const between = describePhase(phaseAt(at('2027-01-16T13:30:00Z'), S), S)
    expect(between.headline).toBe('Polls for Saturday 16 January 2027 closed to new arrivals at 2:30 PM WAT.')
    expect(between.details[0]).toBe('Everyone on the queue by 2:30 PM is entitled to vote. For results, see INEC’s Result Viewing Portal (IReV).')
    expect(between.showResultsLink).toBe(true)
  })
})

describe('the device time zone changes nothing', () => {
  const original = process.env.TZ
  afterEach(() => {
    process.env.TZ = original
  })
  for (const tz of ['UTC', 'Africa/Lagos', 'America/New_York', 'Asia/Tokyo']) {
    it(tz, () => {
      process.env.TZ = tz
      const p = phaseAt(at('2027-01-16T07:29:00Z'), S)
      expect(p).toMatchObject({ kind: 'before', msToOpen: MIN })
      expect(describePhase(p, S).details[0]).toBe('Saturday 16 January 2027, 8:30 AM to 2:30 PM WAT: President, Senate and House of Representatives.')
      expect(formatDay('2027-02-06')).toBe('Saturday 6 February 2027')
    })
  }
})
