import type { Metadata } from 'next'

import { FebBallot } from '@/components/FebBallot'
import { febBallots, febBallotTitle, race } from '@/lib/data'
import { pageMeta } from '@/lib/seo'
import { cardAlt, cardPath, febCardRace } from '@/lib/site'

export const dynamicParams = false
export function generateStaticParams() {
  return febBallots().filter(b => b.key).map(b => ({ state: b.stateSlug, key: b.key }))
}

async function ballotOf(params: Promise<{ state: string, key: string }>) {
  const { state, key } = await params
  const b = febBallots().find(x => x.stateSlug === state && x.key === key)
  if (!b) throw new Error(`unknown 6 February ballot ${state}/${key}`)
  return b
}

export async function generateMetadata({ params }: { params: Promise<{ state: string, key: string }> }): Promise<Metadata> {
  const b = await ballotOf(params)
  const card = febCardRace(b.governor, b.sha)
  return pageMeta({
    title: febBallotTitle(b), path: b.path, description: 'Every race and every candidate on this ballot for 6 February 2027, as listed by INEC.',
    ...(card ? { image: { url: cardPath(card), alt: cardAlt(race(card)) } } : {}),
  })
}

export default async function Page({ params }: { params: Promise<{ state: string, key: string }> }) {
  return <FebBallot b={await ballotOf(params)} />
}
