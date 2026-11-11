import type { Metadata } from 'next'

import { INEC_2027, INEC_LOCATOR } from '@/components/RaceSection'
import { CivicNote } from '@/components/CivicNote'
import { Countdown } from '@/components/Countdown'
import { JsonLd } from '@/components/JsonLd'
import { SourceLine } from '@/components/SourceLine'
import { electionDay } from '@/lib/data'
import { formatDay, formatTime } from '@/lib/election'
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
  const open = formatTime(d.hours.open)
  const close = formatTime(d.hours.close)
  return (
    <>
      <JsonLd data={pageGraph('/election-day/', 'Election day: times and what to bring', [['Home', '/'], ['Election day', '/election-day/']])} />
      <section className="hero hero-plain" aria-labelledby="ed-title">
        <h1 id="ed-title">Election day</h1>
        <p className="hero-line">{`Polls open at ${open} and close to new arrivals at ${close} WAT. What to bring, what to expect and INEC’s own tools.`}</p>
        <Countdown headingLevel={2} />
      </section>

      <section aria-labelledby="dates">
        <h2 id="dates">Dates and times</h2>
        <ul className="date-cards">
          {d.elections.map(e => (
            <li key={e.id} className="date-card" data-claim data-source={e.source_id}>
              <p className="date-day">{formatDay(e.date)}</p>
              <p className="date-time">{`${open} to ${close} WAT`}</p>
              <p className="date-races">{`${e.races}.`}</p>
            </li>
          ))}
        </ul>
        <p>Governorship elections on 6 February are held in the participating states only.</p>
        <SourceLine id="inec-calendar" what="Dates" />
        <SourceLine id="inec-voter-education" what="Times" />
      </section>

      <section aria-labelledby="expect">
        <h2 id="expect">What to bring and what to expect</h2>
        <ol className="step-cards">
          {d.steps.map((s, i) => (
            <li key={s.text} className="step-card" data-claim data-source={d.steps_source_id}>
              <span className="step-n" aria-hidden="true">{i + 1}</span>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <SourceLine id={d.steps_source_id} what="All of the above" />
      </section>

      <section aria-labelledby="tools">
        <h2 id="tools">INEC’s own tools</h2>
        <ul className="link-list tiles tiles-wide">
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

      <p><a className="btn btn-big" href="/">Find who’s on your ballot</a></p>
      <CivicNote />
    </>
  )
}
