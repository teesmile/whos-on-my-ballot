import type { Metadata } from 'next'

import { badgeFor, RaceSection, RaceTabs, UnresolvedGroup } from '@/components/RaceSection'
import { SourceLine } from '@/components/SourceLine'
import { ballots, janBallotTitle, presidentialRace, race } from '@/lib/data'
import { JsonLd } from '@/components/JsonLd'
import { pageGraph, pageMeta } from '@/lib/seo'
import { ballotCardRace, cardAlt, cardPath } from '@/lib/site'

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
  const card = race(ballotCardRace(b.house, presidentialRace().id))
  return pageMeta({
    title: janBallotTitle(b), path: b.path, description: 'Every race and every candidate on this ballot for 16 January 2027, as listed by INEC.',
    image: { url: cardPath(card.id), alt: cardAlt(card) },
  })
}

export default async function BallotPage({ params }: { params: Promise<{ state: string, key: string }> }) {
  const b = await ballotOf(params)
  const senate = b.senate.map(race)
  const house = b.house.map(race)
  const pres = presidentialRace()
  return (
    <>
      <JsonLd data={pageGraph(b.path, janBallotTitle(b), [['Home', '/'], [b.state.name, `/state/${b.state.code}/`], [janBallotTitle(b), b.path]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        <span aria-hidden="true"> / </span>
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
      <RaceTabs panels={[
        { key: 'president', label: 'President', title: 'President', ...badgeFor([pres]), content: <RaceSection r={pres} shareUrl={`${b.path}#president`} /> },
        {
          key: 'senate', label: 'Senate', title: 'Senate', ...badgeFor(senate),
          content: senate.length === 1 ? <RaceSection r={senate[0]} shareUrl={`${b.path}#senate`} /> : <UnresolvedGroup office="Senate" list={senate} path={b.path} />,
        },
        {
          key: 'house', label: 'House of Reps', title: 'House of Representatives', ...badgeFor(house),
          content: house.length === 1 ? <RaceSection r={house[0]} shareUrl={`${b.path}#house`} /> : <UnresolvedGroup office="House of Representatives" list={house} path={b.path} />,
        },
      ]}
      />
      <p className="go"><a className="btn btn-secondary" href={`/state/${b.state.code}/`}>Not your polling unit? Search again</a></p>
    </>
  )
}
