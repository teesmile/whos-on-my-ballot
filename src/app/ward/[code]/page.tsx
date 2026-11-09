import type { Metadata } from 'next'

import { SourceLine } from '@/components/SourceLine'

import { puHash } from '@/lib/core'
import { findWard, stateGeo, states, wardBallotPath } from '@/lib/data'

export const dynamicParams = false
export function generateStaticParams() {
  return states().flatMap(s => stateGeo(s.code).lgas.flatMap(l => l.wards.map(w => ({ code: w.code.replaceAll('/', '-') }))))
}

const wardOf = async (params: Promise<{ code: string }>) => findWard((await params).code.replaceAll('-', '/'))

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { lga, ward } = await wardOf(params)
  return { title: `${ward.name}, ${lga.name}` }
}

export default async function WardPage({ params }: { params: Promise<{ code: string }> }) {
  const { state, lga, ward } = await wardOf(params)
  const path = wardBallotPath(state, ward)
  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        {' / '}
        <a href={`/state/${state.code}/`}>{state.name}</a>
        {' / '}
        <a href={`/lga/${lga.code.replace('/', '-')}/`}>{lga.name}</a>
      </nav>
      <h1>
        {ward.name}
        {' '}
        <span className="sub">ward</span>
      </h1>
      <SourceLine id="inec-pu-locator" what="LGAs, wards and polling units" />
      <h2>Is this your polling unit?</h2>
      <p>Choose your polling unit to see your ballot. The code after each name is the delimitation code printed on voter cards.</p>
      <ul className="link-list pu-list" data-ballot={path}>
        {ward.polling_units.map(p => (
          <li key={p.code}>
            <a href={`${path}${puHash(p.code)}`}>
              {p.name}
              {' '}
              <span className="code">{p.code}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}
