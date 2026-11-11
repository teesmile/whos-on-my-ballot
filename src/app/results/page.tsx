import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { MapKey, ResultsTable, StateMap, waitingLine } from '@/components/Results'
import { febRaces, presidentialRace, states } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'
import { slug } from '@/lib/core'

const TITLE = 'Results'
export const metadata: Metadata = pageMeta({
  title: 'Election results', path: '/results/',
  description: 'Results for President from 16 January 2027 and for Governor from 6 February 2027, each figure with its source, time and status.',
})

/** The results page in its waiting state: the finished design, with no figures until there are real ones. */
export default function ResultsPage() {
  const pres = presidentialRace()
  const govs = febRaces().filter(r => r.office === 'governor').sort((a, b) => (a.state ?? '').localeCompare(b.state ?? ''))
  const all = states()
  return (
    <>
      <JsonLd data={pageGraph('/results/', TITLE, [['Home', '/'], ['Results', '/results/']])} />
      <h1>Results</h1>
      <p className="lead">
        Results for President will appear here from 16 January 2027, and for Governor from 6 February 2027. Every figure will show where it
        comes from, when it was published, and whether INEC has declared it.
      </p>

      <section className="results-panel" aria-labelledby="president">
        <div className="rp-head">
          <h2 id="president">President</h2>
          <p className="rp-status"><span className="status-pill">Awaiting results</span></p>
        </div>
        <p className="rp-wait">{waitingLine(pres)}</p>
        <p className="rp-count">
          States reported:
          {' '}
          <strong>{`0 of ${all.length}`}</strong>
        </p>
        <div className="rp-grid">
          <div className="rp-main">
            <ResultsTable r={pres} label="President: candidates, in the ballot page’s order" />
          </div>
          <div className="rp-side">
            <h3 className="rp-sub">States</h3>
            <StateMap names={all} />
            <MapKey />
          </div>
        </div>
      </section>

      <section className="results-panel" aria-labelledby="governors">
        <div className="rp-head">
          <h2 id="governors">Governor</h2>
          <p className="rp-status"><span className="status-pill">Awaiting results</span></p>
        </div>
        <p className="rp-wait">{`Results will appear here from 6 February 2027, in the ${govs.length} states with a governorship election.`}</p>
        <h3 className="rp-sub">Pick a state</h3>
        <ul className="link-list tiles">
          {govs.map(r => <li key={r.id}><a href={`/results/governor/${slug(r.state ?? '')}/`}>{r.name}</a></li>)}
        </ul>
      </section>

      <section className="results-panel" aria-labelledby="other-races">
        <h2 id="other-races">Senate, House of Representatives and State Houses of Assembly</h2>
        <p>
          For these races, the declared winner will be shown on each race’s ballot page once INEC publishes its list of those elected.
        </p>
      </section>
    </>
  )
}
