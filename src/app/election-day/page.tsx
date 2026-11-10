import type { Metadata } from 'next'

import { INEC_2027, INEC_LOCATOR } from '@/components/RaceSection'
import { JsonLd } from '@/components/JsonLd'
import { SourceLine } from '@/components/SourceLine'
import { electionDay } from '@/lib/data'
import { formatDay, formatTime, type Schedule } from '@/lib/election'
import { pageGraph, pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta({
  title: 'Election day: times and what to bring', suffix: true, path: '/election-day/',
  description: 'When polls open and close on 16 January and 6 February 2027, what to bring, and INEC’s own tools.',
})

export const INEC_IREV = 'https://inecelectionresults.ng/'
export const INEC_CVR = 'https://cvr.inecnigeria.org/'
export const INEC_OFFICES = 'https://www.inecnigeria.org/about/state-offices'
export const INEC_EDUCATION = 'https://www.inecnigeria.org/voters/education'

export default function ElectionDay() {
  const d = electionDay()
  const schedule: Schedule = { elections: d.elections.map(({ id, date, races }) => ({ id, date, races })), open: d.hours.open, close: d.hours.close }
  const [first] = [...d.elections].sort((a, b) => a.date.localeCompare(b.date))
  const open = formatTime(d.hours.open)
  const close = formatTime(d.hours.close)
  return (
    <>
      <JsonLd data={pageGraph('/election-day/', 'Election day: times and what to bring', [['Home', '/'], ['Election day', '/election-day/']])} />
      <h1>Election day</h1>
      {/* Server text is the schedule itself; the page script replaces it with where we are in it (no live announcements). */}
      <div className="countdown" data-countdown={JSON.stringify(schedule)}>
        <p className="headline">
          Polls open
          {' '}
          {formatDay(first.date)}
          {' at '}
          {open}
          {' WAT.'}
        </p>
      </div>

      <section aria-labelledby="dates">
        <h2 id="dates">Dates and times</h2>
        <ul className="entries">
          {d.elections.map(e => (
            <li key={e.id} data-claim data-source={e.source_id}>
              <p className="entry">
                <strong>{formatDay(e.date)}</strong>
                {`, ${open} to ${close} WAT: ${e.races}.`}
              </p>
            </li>
          ))}
        </ul>
        <p>Governorship elections on 6 February are held in the participating states only.</p>
        <SourceLine id="inec-calendar" what="Dates" />
        <SourceLine id="inec-voter-education" what="Times" />
      </section>

      <section aria-labelledby="expect">
        <h2 id="expect">What to bring and what to expect</h2>
        <ol className="steps">
          {d.steps.map(s => <li key={s.text} data-claim data-source={d.steps_source_id}>{s.text}</li>)}
        </ol>
        <SourceLine id={d.steps_source_id} what="All of the above" />
      </section>

      <section aria-labelledby="tools">
        <h2 id="tools">INEC’s own tools</h2>
        <ul className="link-list">
          <li><a href={INEC_LOCATOR}>Find your polling unit (INEC Polling Unit Locator)</a></li>
          <li><a href={INEC_CVR}>Voter registration and PVC status (INEC CVR portal)</a></li>
          <li><a href={INEC_IREV}>Results as polling units upload them (INEC Result Viewing Portal, IReV)</a></li>
          <li><a href={INEC_OFFICES}>INEC state and LGA offices</a></li>
          <li><a href={INEC_EDUCATION}>INEC voter education and guidelines</a></li>
        </ul>
        <p>
          Dates and times are as INEC has published them. If INEC announces a change, INEC’s announcement applies:
          {' '}
          <a href={INEC_2027}>INEC 2027 general elections page</a>
          .
        </p>
      </section>

      <p><a href="/">Find who’s on your ballot</a></p>
    </>
  )
}
