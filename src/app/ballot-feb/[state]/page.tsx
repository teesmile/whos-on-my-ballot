import type { Metadata } from 'next'

import { FebBallot } from '@/components/FebBallot'
import { febBallots, febBallotTitle, race } from '@/lib/data'
import { pageMeta } from '@/lib/seo'
import { cardAlt, cardPath, febCardRace } from '@/lib/site'

// States where no State Assembly race applies on the list: Borno (not on INEC's list, OI-11) and the FCT (no assembly).
export const dynamicParams = false
export function generateStaticParams() {
  return febBallots().filter(b => !b.key).map(b => ({ state: b.stateSlug }))
}

async function ballotOf(params: Promise<{ state: string }>) {
  const { state } = await params
  const b = febBallots().find(x => x.stateSlug === state && !x.key)
  if (!b) throw new Error(`unknown 6 February ballot ${state}`)
  return b
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const b = await ballotOf(params)
  const card = febCardRace(b.governor, b.sha)
  return pageMeta({
    title: febBallotTitle(b), path: b.path,
    description: b.state.name === 'FCT'
      ? 'There is no election in the FCT on 6 February 2027: the FCT has no governor and no State House of Assembly.'
      : `The ${b.state.name} ballot for 6 February 2027, as listed by INEC.`,
    ...(card ? { image: { url: cardPath(card), alt: cardAlt(race(card)) } } : {}),
  })
}

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  return <FebBallot b={await ballotOf(params)} />
}
