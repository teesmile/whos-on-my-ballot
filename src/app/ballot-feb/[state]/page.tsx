import type { Metadata } from 'next'

import { FebBallot } from '@/components/FebBallot'
import { febBallots } from '@/lib/data'
import { cardPath, SITE_URL } from '@/lib/site'

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
  const title = `6 February ballot, ${b.state.name}`
  return {
    title,
    openGraph: { title, url: `${SITE_URL}${b.path}`, ...(b.governor ? { images: [{ url: cardPath(b.governor), width: 1200, height: 630 }] } : {}) },
  }
}

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  return <FebBallot b={await ballotOf(params)} />
}
