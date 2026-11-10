import type { Metadata } from 'next'

import { RaceSection, raceTitle, UnresolvedGroup } from '@/components/RaceSection'
import { SourceLine } from '@/components/SourceLine'
import { ballots, presidentialRace, race } from '@/lib/data'
import { ballotCardRace, cardPath, SITE_URL } from '@/lib/site'

import { Share } from '@/components/Share'

export const dynamicParams = false
export function generateStaticParams() {
  return ballots().map(b => ({ state: b.stateSlug, key: b.key }))
}

async function ballotOf(params: Promise<{ state: string, key: string }>) {
  const { state, key } = await params
  const b = ballots().find(x => x.stateSlug === state && x.key === key)
  if (!b) throw new Error(`unknown ballot ${state}/${key}`)
  return b
}

export async function generateMetadata({ params }: { params: Promise<{ state: string, key: string }> }): Promise<Metadata> {
  const b = await ballotOf(params)
  const title = `Ballot: ${b.house.map(id => race(id).name).join(' or ')}, ${b.state.name}`
  return {
    title,
    description: 'Every race and every candidate on this ballot for 16 January 2027, as listed by INEC.',
    openGraph: { title, url: `${SITE_URL}${b.path}`, images: [{ url: cardPath(ballotCardRace(b.house, presidentialRace().id)), width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function BallotPage({ params }: { params: Promise<{ state: string, key: string }> }) {
  const b = await ballotOf(params)
  const senate = b.senate.map(race)
  const house = b.house.map(race)
  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        {' / '}
        <a href={`/state/${b.state.code}/`}>{b.state.name}</a>
      </nav>
      <h1>Your ballot for 16 January 2027</h1>
      <div className="pu-confirmed" data-lookup="confirm" data-election="jan" data-state={b.state.code} role="status" aria-live="polite" hidden />
      <p className="lead">
        {b.state.name}
        {' · '}
        Every race on this ballot, with every candidate as INEC listed them.
      </p>
      <SourceLine id="inec-pu-locator" what="Polling units and their wards and LGAs" />
      <SourceLine id="inec-constituencies-workbook" what="Which Senate district and House constituency each LGA is in" />
      <nav aria-label="Races on this ballot" className="toc">
        <ul>
          <li><a href="#race-jan-2027-president">President</a></li>
          {[...senate, ...house].map(r => <li key={r.id}><a href={`#race-${r.id}`}>{raceTitle(r)}</a></li>)}
        </ul>
      </nav>
      <RaceSection r={presidentialRace()} />
      {senate.length === 1 ? <RaceSection r={senate[0]} /> : <UnresolvedGroup office="Senate" list={senate} />}
      {house.length === 1 ? <RaceSection r={house[0]} /> : <UnresolvedGroup office="House of Representatives" list={house} />}
      <Share label="Share this ballot" text={`Every candidate on the ballot for ${house.map(r => r.name).join(' or ')}, ${b.state.name}, as listed by INEC:`} url={`${SITE_URL}${b.path}`} />
      <p><a href={`/state/${b.state.code}/`}>Not your polling unit? Search again</a></p>
    </>
  )
}
