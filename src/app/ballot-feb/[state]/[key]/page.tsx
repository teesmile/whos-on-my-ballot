import type { Metadata } from 'next'

import { FebBallot } from '@/components/FebBallot'
import { febBallots, race } from '@/lib/data'
import { cardPath, febCardRace, SITE_URL } from '@/lib/site'

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
  const title = `6 February ballot: ${b.sha.map(id => race(id).name).join(' or ')}, ${b.state.name}`
  const card = febCardRace(b.governor, b.sha)
  return {
    title,
    description: 'Every race and every candidate on this ballot for 6 February 2027, as listed by INEC.',
    openGraph: { title, url: `${SITE_URL}${b.path}`, ...(card ? { images: [{ url: cardPath(card), width: 1200, height: 630 }] } : {}) },
    twitter: { card: card ? 'summary_large_image' : 'summary' },
  }
}

export default async function Page({ params }: { params: Promise<{ state: string, key: string }> }) {
  return <FebBallot b={await ballotOf(params)} />
}
