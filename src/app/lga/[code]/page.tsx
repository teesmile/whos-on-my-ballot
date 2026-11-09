import type { Metadata } from 'next'

import { SourceLine } from '@/components/SourceLine'

import { findLga, stateGeo, states } from '@/lib/data'

export const dynamicParams = false
export function generateStaticParams() {
  return states().flatMap(s => stateGeo(s.code).lgas.map(l => ({ code: l.code.replace('/', '-') })))
}

const lgaOf = async (params: Promise<{ code: string }>) => findLga((await params).code.replace('-', '/'))

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { state, lga } = await lgaOf(params)
  return { title: `${lga.name}, ${state.name}` }
}

export default async function LgaPage({ params }: { params: Promise<{ code: string }> }) {
  const { state, lga } = await lgaOf(params)
  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        {' / '}
        <a href={`/state/${state.code}/`}>{state.name}</a>
      </nav>
      <h1>
        {lga.name}
        {' '}
        <span className="sub">LGA</span>
      </h1>
      <SourceLine id="inec-pu-locator" what="LGAs, wards and polling units" />
      <h2>Choose your ward</h2>
      <ul className="link-list columns">
        {lga.wards.map(w => (
          <li key={w.code}><a href={`/ward/${w.code.replaceAll('/', '-')}/`}>{w.name}</a></li>
        ))}
      </ul>
    </>
  )
}
