import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { SourceLine } from '@/components/SourceLine'
import { Steps } from '@/components/Steps'

import { findLga, stateGeo, states } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'

export const dynamicParams = false
export function generateStaticParams() {
  return states().flatMap(s => stateGeo(s.code).lgas.map(l => ({ code: l.code.replace('/', '-') })))
}

/** Under 60 characters for every LGA: the place, then 2027 and our own words while they fit. */
const lgaTitle = (lga: string, state: string) =>
  [`${lga} LGA, ${state}: 2027 candidates by ward`, `${lga} LGA, ${state}: 2027 ballot`].find(t => t.length <= 60) ?? `${lga} LGA, ${state}, 2027`

const lgaOf = async (params: Promise<{ code: string }>) => findLga((await params).code.replace('-', '/'))

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { state, lga } = await lgaOf(params)
  return pageMeta({
    title: lgaTitle(lga.name, state.name), suffix: true, path: `/lga/${lga.code.replace('/', '-')}/`,
    description: `The wards of ${lga.name} LGA, ${state.name}. Choose yours to find your polling unit and every candidate on your 2027 ballot.`,
  })
}

export default async function LgaPage({ params }: { params: Promise<{ code: string }> }) {
  const { state, lga } = await lgaOf(params)
  const path = `/lga/${lga.code.replace('/', '-')}/`
  return (
    <>
      <JsonLd data={pageGraph(path, lgaTitle(lga.name, state.name), [['Home', '/'], [state.name, `/state/${state.code}/`], [lga.name, path]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        <span aria-hidden="true"> / </span>
        <a href={`/state/${state.code}/`}>{state.name}</a>
      </nav>
      <h1>
        {lga.name}
        {' '}
        <span className="sub">LGA</span>
      </h1>
      <Steps current={3} />
      <section aria-labelledby="wards" className="panel">
        <h2 id="wards">Choose your ward</h2>
        <p className="panel-intro">Then your polling unit.</p>
        <ul className="link-list tiles">
          {lga.wards.map(w => (
            <li key={w.code}><a href={`/ward/${w.code.replaceAll('/', '-')}/`}>{w.name}</a></li>
          ))}
        </ul>
      </section>
      <SourceLine id="inec-pu-locator" what="LGAs, wards and polling units" />
    </>
  )
}
