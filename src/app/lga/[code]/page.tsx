import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { SourceLine } from '@/components/SourceLine'

import { findLga, stateGeo, states } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'

export const dynamicParams = false
export function generateStaticParams() {
  return states().flatMap(s => stateGeo(s.code).lgas.map(l => ({ code: l.code.replace('/', '-') })))
}

const lgaOf = async (params: Promise<{ code: string }>) => findLga((await params).code.replace('-', '/'))

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { state, lga } = await lgaOf(params)
  return pageMeta({
    title: `${lga.name} LGA, ${state.name}: wards`, suffix: true, path: `/lga/${lga.code.replace('/', '-')}/`,
    description: `The wards of ${lga.name} LGA, ${state.name}. Choose yours to find your polling unit and every candidate on your 2027 ballot.`,
  })
}

export default async function LgaPage({ params }: { params: Promise<{ code: string }> }) {
  const { state, lga } = await lgaOf(params)
  const path = `/lga/${lga.code.replace('/', '-')}/`
  return (
    <>
      <JsonLd data={pageGraph(path, `${lga.name} LGA, ${state.name}: wards`, [['Home', '/'], [state.name, `/state/${state.code}/`], [lga.name, path]])} />
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
