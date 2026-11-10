import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { SourceLine } from '@/components/SourceLine'

import { stateGeo, states } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'

const titleOf = (name: string) => `${name}: find your polling unit`

export const dynamicParams = false
export function generateStaticParams() {
  return states().map(s => ({ code: s.code }))
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const st = stateGeo((await params).code)
  return pageMeta({
    title: titleOf(st.name), suffix: true, path: `/state/${st.code}/`,
    description: `Find your polling unit in ${st.name}: search by its name or a landmark near it, or browse the LGAs and wards, then see every candidate on your ballot.`,
  })
}

export default async function StatePage({ params }: { params: Promise<{ code: string }> }) {
  const st = stateGeo((await params).code)
  return (
    <>
      <JsonLd data={pageGraph(`/state/${st.code}/`, titleOf(st.name), [['Home', '/'], [st.name, `/state/${st.code}/`]])} />
      <nav aria-label="Breadcrumb" className="crumbs"><a href="/">All states</a></nav>
      <h1>{st.name}</h1>
      <section aria-labelledby="search" className="by-search">
        <h2 id="search">Search for your polling unit</h2>
        <form className="lookup" data-lookup="search" data-state={st.code} hidden>
          <label htmlFor="lga">Your LGA</label>
          <select id="lga" name="lga" defaultValue="">
            <option value="" disabled>Choose your LGA</option>
            {st.lgas.map(l => <option key={l.code} value={l.code.split('/')[1]}>{l.name}</option>)}
          </select>
          <label htmlFor="q">
            Polling unit name, or a landmark near it
            <span className="hint">For example a school, market or church</span>
          </label>
          <input id="q" name="q" type="search" autoComplete="off" spellCheck={false} />
          <button type="submit">Search</button>
          <div className="result" role="status" aria-live="polite" />
        </form>
        <noscript><p>Search needs JavaScript. Choose your LGA below instead.</p></noscript>
      </section>
      <SourceLine id="inec-pu-locator" what="LGAs, wards and polling units" />
      <section aria-labelledby="browse">
        <h2 id="browse">Or choose your LGA</h2>
        <ul className="link-list columns">
          {st.lgas.map(l => (
            <li key={l.code}><a href={`/lga/${l.code.replace('/', '-')}/`}>{l.name}</a></li>
          ))}
        </ul>
      </section>
    </>
  )
}
