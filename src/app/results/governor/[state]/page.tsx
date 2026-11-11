import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { ResultsTable, waitingLine } from '@/components/Results'
import { slug } from '@/lib/core'
import { febRaces, stateGeo, states } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'
import { raceTitle } from '@/lib/share'

const govs = () => febRaces().filter(r => r.office === 'governor')
const bySlug = (s: string) => {
  const r = govs().find(x => slug(x.state ?? '') === s)
  if (!r) throw new Error(`no governorship race for ${s}`)
  return r
}

export const dynamicParams = false
export function generateStaticParams() {
  return govs().map(r => ({ state: slug(r.state ?? '') }))
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const r = bySlug((await params).state)
  return pageMeta({
    title: `${raceTitle(r)}: results`, path: `/results/governor/${slug(r.state ?? '')}/`,
    description: `Results for ${raceTitle(r)} will appear here from 6 February 2027, each figure with its source, time and status.`,
  })
}

export default async function GovernorResults({ params }: { params: Promise<{ state: string }> }) {
  const r = bySlug((await params).state)
  const path = `/results/governor/${slug(r.state ?? '')}/`
  const ref = states().find(s => s.name === r.state)!
  const lgas = stateGeo(ref.code).lgas
  return (
    <>
      <JsonLd data={pageGraph(path, `${raceTitle(r)}: results`, [['Home', '/'], ['Results', '/results/'], [r.name, path]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/results/#governors">All results</a>
      </nav>
      <h1>{`${raceTitle(r)}: results`}</h1>
      <section className="results-panel" aria-labelledby="race">
        <div className="rp-head">
          <h2 id="race">{raceTitle(r)}</h2>
          <p className="rp-status"><span className="status-pill">Awaiting results</span></p>
        </div>
        <p className="rp-wait">{waitingLine(r)}</p>
        <p className="rp-count">
          Local government areas reported:
          {' '}
          <strong>{`0 of ${lgas.length}`}</strong>
        </p>
        <ResultsTable r={r} label={`${raceTitle(r)}: candidates, in the ballot page’s order`} />
        <h3 className="rp-sub">Local government areas</h3>
        <ul className="lga-map" aria-label="Local government areas: reported or awaiting">
          {lgas.map(l => (
            <li key={l.code} data-status="awaiting">
              {l.name}
              <span className="visually-hidden">: awaiting</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
