/**
 * Election-day schedule logic, shared by the build and the browser (no I/O). Every time is an absolute instant in
 * West Africa Time (UTC+1, no daylight saving), so a visitor's device time zone never changes what is shown.
 */

export interface ElectionDate {
  id: string
  date: string // YYYY-MM-DD, as INEC's calendar gives it
  races: string
}

export interface Schedule {
  elections: ElectionDate[]
  open: string // HH:MM in WAT
  close: string // HH:MM in WAT
}

const WAT_OFFSET = '+01:00'
const TZ = 'Africa/Lagos'

export function instant(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00${WAT_OFFSET}`)
}

export type Phase =
  | { kind: 'before', next: ElectionDate, msToOpen: number }
  | { kind: 'voting', current: ElectionDate, msToClose: number }
  | { kind: 'between', closed: ElectionDate, next: ElectionDate, msToOpen: number }
  | { kind: 'after', closed: ElectionDate }

/** Where `now` falls in the schedule. Polls are open from `open` (inclusive) to `close` (exclusive). */
export function phaseAt(now: Date, s: Schedule): Phase {
  const list = [...s.elections].sort((a, b) => a.date.localeCompare(b.date))
  let lastClosed: ElectionDate | null = null
  for (const e of list) {
    const open = instant(e.date, s.open).getTime()
    const close = instant(e.date, s.close).getTime()
    const t = now.getTime()
    if (t < open) {
      return lastClosed
        ? { kind: 'between', closed: lastClosed, next: e, msToOpen: open - t }
        : { kind: 'before', next: e, msToOpen: open - t }
    }
    if (t < close) return { kind: 'voting', current: e, msToClose: close - t }
    lastClosed = e
  }
  if (!lastClosed) throw new Error('schedule has no elections')
  return { kind: 'after', closed: lastClosed }
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/** "67 days, 9 hours and 12 minutes", rounded down to the minute. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return 'less than a minute'
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts = [days && plural(days, 'day'), hours && plural(hours, 'hour'), minutes && plural(minutes, 'minute')].filter(Boolean) as string[]
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
}

/** "8:30 AM" from "08:30". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "Saturday 16 January 2027", computed in Nigerian time whatever the device's time zone. */
export function formatDay(date: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
    .formatToParts(instant(date, '12:00'))
  const get = (type: string) => parts.find(p => p.type === type)!.value
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
}

export interface PhaseText {
  headline: string
  details: string[]
  showResultsLink: boolean
}

/** Plain-language text for a phase. Only facts from INEC's calendar and voting procedure, nothing else. */
export function describePhase(p: Phase, s: Schedule): PhaseText {
  const open = formatTime(s.open)
  const close = formatTime(s.close)
  const closedText = (e: ElectionDate) => ({
    headline: `Polls for ${formatDay(e.date)} closed to new arrivals at ${close} WAT.`,
    queue: `Everyone on the queue by ${close} is entitled to vote. For results, see INEC’s Result Viewing Portal (IReV).`,
  })
  switch (p.kind) {
    case 'before':
      return {
        headline: `Polls open in ${formatDuration(p.msToOpen)}.`,
        details: [`${formatDay(p.next.date)}, ${open} to ${close} WAT: ${p.next.races}.`],
        showResultsLink: false,
      }
    case 'voting':
      return {
        headline: 'Voting is underway.',
        details: [
          `${p.current.races}. Polls close to new arrivals at ${close} WAT, in ${formatDuration(p.msToClose)}.`,
          `Everyone on the queue by ${close} is entitled to vote.`,
        ],
        showResultsLink: false,
      }
    case 'between': {
      const t = closedText(p.closed)
      return {
        headline: t.headline,
        details: [t.queue, `Next: ${formatDay(p.next.date)}, ${open} to ${close} WAT: ${p.next.races}. Polls open in ${formatDuration(p.msToOpen)}.`],
        showResultsLink: true,
      }
    }
    case 'after': {
      const t = closedText(p.closed)
      return { headline: t.headline, details: [t.queue], showResultsLink: true }
    }
  }
}
