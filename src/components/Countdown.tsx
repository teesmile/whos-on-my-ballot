import { electionDay } from '@/lib/data'
import { formatDay, formatTime, type Schedule } from '@/lib/election'

import { SourceLine } from './SourceLine'

/**
 * The countdown to the next election day, in Nigerian time (WAT), as four boxes the page script fills and ticks.
 * Without JavaScript the dates and opening time show on their own. Screen readers get one sentence with the date and the
 * days left, rewritten only when the day changes: never an announcement every second.
 */
export function Countdown({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const d = electionDay()
  const schedule: Schedule = { elections: d.elections.map(({ id, date, races }) => ({ id, date, races })), open: d.hours.open, close: d.hours.close }
  const list = [...d.elections].sort((a, b) => a.date.localeCompare(b.date))
  const open = formatTime(d.hours.open)
  const H = `h${headingLevel}` as 'h2' | 'h3'
  return (
    <section className="clock" aria-labelledby="clock-title" data-clock={JSON.stringify(schedule)}>
      <H id="clock-title" className="clock-title">Next election day</H>
      <div className="clock-face">
        <p className="clock-static" data-clock-static>
          {`Polls open ${formatDay(list[0].date)} at ${open} WAT.`}
        </p>
        <div className="clock-boxes" aria-hidden="true" hidden>
          {(['days', 'hours', 'minutes', 'seconds'] as const).map(u => (
            <span className="clock-box" key={u}>
              <span className="clock-n" data-unit={u}>00</span>
              <span className="clock-u">{u}</span>
            </span>
          ))}
        </div>
        <p className="visually-hidden" data-clock-sr />
      </div>
      <ul className="clock-dates">
        {list.map(e => (
          <li key={e.id} data-date={e.date}>
            <strong>{formatDay(e.date).replace(/^Saturday /, '')}</strong>
            <span>{e.races}</span>
          </li>
        ))}
      </ul>
      <SourceLine id="inec-calendar" what="Dates" />
    </section>
  )
}
