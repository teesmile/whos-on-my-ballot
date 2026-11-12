import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { SourceLine } from '@/components/SourceLine'
import { Steps } from '@/components/Steps'

import { cardCode, puHash } from '@/lib/core'
import { findWard, stateGeo, states, wardBallotPath, wardFebBallotPath } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'

const pathOf = (code: string) => `/ward/${code.replaceAll('/', '-')}/`
/** Under 60 characters where INEC's ward name allows: our own words go first, never INEC's. */
function wardTitle(ward: string, lga: string) {
  return [`${ward} ward, ${lga}: polling units`, `${ward} ward, ${lga}`, `${ward} ward`].find(t => t.length <= 60) ?? `${ward} ward`
}
/** Under 155 characters for every ward: the long form, else the same sentence without the LGA and state. */
function wardDescription(ward: string, lga: string, state: string) {
  const long = `Polling units in ${ward} ward, ${lga} LGA, ${state}, each with its ballot for 16 January and 6 February 2027.`
  return long.length <= 155 ? long : `Polling units in ${ward} ward, each with its 2027 ballots.`
}

export const dynamicParams = false
export function generateStaticParams() {
  return states().flatMap(s => stateGeo(s.code).lgas.flatMap(l => l.wards.map(w => ({ code: w.code.replaceAll('/', '-') }))))
}

const wardOf = async (params: Promise<{ code: string }>) => findWard((await params).code.replaceAll('-', '/'))

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { state, lga, ward } = await wardOf(params)
  return pageMeta({
    title: wardTitle(ward.name, lga.name), path: pathOf(ward.code),
    description: wardDescription(ward.name, lga.name, state.name),
  })
}

export default async function WardPage({ params }: { params: Promise<{ code: string }> }) {
  const { state, lga, ward } = await wardOf(params)
  const path = wardBallotPath(state, ward)
  const febPath = wardFebBallotPath(state, ward)
  return (
    <>
      <JsonLd data={pageGraph(pathOf(ward.code), wardTitle(ward.name, lga.name), [['Home', '/'], [state.name, `/state/${state.code}/`], [lga.name, `/lga/${lga.code.replace('/', '-')}/`], [ward.name, pathOf(ward.code)]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        <span aria-hidden="true"> / </span>
        <a href={`/state/${state.code}/`}>{state.name}</a>
        <span aria-hidden="true"> / </span>
        <a href={`/lga/${lga.code.replace('/', '-')}/`}>{lga.name}</a>
      </nav>
      <h1>
        {ward.name}
        {' '}
        <span className="sub">ward</span>
      </h1>
      <Steps current={4} />
      <section aria-labelledby="pus" className="panel">
        <h2 id="pus">Is this your polling unit?</h2>
        <p className="panel-intro">Choose your polling unit to see your ballot for 16 January 2027. The code after each name is the one printed on the voter’s card.</p>
        <ul className="link-list pu-list" data-ballot={path}>
        {ward.polling_units.map(p => (
          <li key={p.code}>
            <a href={`${path}${puHash(p.code)}`}>
              {p.name}
              {' '}
              <span className="code">{cardCode(p.code)}</span>
            </a>
          </li>
        ))}
        </ul>
      </section>
      <SourceLine id="inec-pu-locator" what="LGAs, wards and polling units" />
      <h2>6 February 2027</h2>
      <p>Every polling unit in this ward has the same ballot on 6 February.</p>
      <p className="go"><a className="btn feb-link" href={febPath} data-feb-ballot>{`Your ballot for 6 February 2027, ${ward.name} ward`}</a></p>
    </>
  )
}
