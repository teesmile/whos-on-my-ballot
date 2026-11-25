import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { RaceSection } from '@/components/RaceSection'
import { allRaces, race } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'
import { ELECTION_DAY, raceTitle } from '@/lib/share'
import { raceMetaDescription, raceMetaTitle } from '@/lib/titles'
import { cardAlt, cardPath, racePath } from '@/lib/site'

/**
 * One race on its own, for "Everyone in this race" from a candidate's page. It is not anyone's ballot, so it never shows a
 * place the visitor didn't pick (owner feedback, 11 Nov 2026); it asks them to choose their state for their own ballot.
 */
export const dynamicParams = false
export function generateStaticParams() {
  return allRaces().map(r => ({ id: r.id }))
}

/** A race's page title and description: the owner's search patterns (D-100), in src/lib/titles.ts. */
const title = raceMetaTitle

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = race((await params).id)
  return pageMeta({
    title: title(r), path: racePath(r.id),
    description: raceMetaDescription(r),
    image: { url: cardPath(r.id), alt: cardAlt(r) },
  })
}

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const r = race((await params).id)
  return (
    <>
      <JsonLd data={pageGraph(racePath(r.id), title(r), [['Home', '/'], [raceTitle(r), racePath(r.id)]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
      </nav>
      <h1>{`${raceTitle(r)} - ${ELECTION_DAY[r.election]}`}</h1>
      <div className="note choose-first">
        <p>
          This page shows one race. To see every race on your own ballot, choose your state first.
        </p>
        <p className="choose-first-go"><a className="btn" href="/#by-state">Choose your state</a></p>
      </div>
      <RaceSection r={r} pageUrl={racePath(r.id)} />
    </>
  )
}
