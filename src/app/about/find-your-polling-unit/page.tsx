import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { INEC_LOCATOR } from '@/components/RaceSection'
import { SourceLine } from '@/components/SourceLine'
import { pageGraph, pageMeta } from '@/lib/seo'

const TITLE = 'How to find your polling unit'
export const metadata: Metadata = pageMeta({
  title: 'How to find your polling unit for 2027', path: '/about/find-your-polling-unit/',
  description: 'Find your polling unit by its code, its name or a landmark, or by browsing your state, LGA and ward, then see every candidate on your ballot.',
})

export default function FindYourPollingUnit() {
  return (
    <>
      <JsonLd data={pageGraph('/about/find-your-polling-unit/', TITLE, [['Home', '/'], ['About', '/about/'], [TITLE, '/about/find-your-polling-unit/']])} />
      <nav aria-label="Breadcrumb" className="crumbs"><a href="/about/">About</a></nav>
      <h1>{TITLE}</h1>
      <p className="lead">
        Your ballot depends on the polling unit where you are registered to vote, not on where you live or where you are now. Find that polling
        unit, and this site shows every race and every candidate on your ballot for 16 January and 6 February 2027.
      </p>

      <h2>Three ways to find it</h2>
      <ol>
        <li>
          <strong>By its code.</strong>
          {' '}
          On the
          {' '}
          <a href="/">home page</a>
          , type the four numbers of your polling unit’s delimitation code, for example 24/15/03/012. The numbers are the state, the LGA, the
          ward and the polling unit.
        </li>
        <li>
          <strong>By its name or a landmark.</strong>
          {' '}
          Choose your state, then your LGA, and type the polling unit’s name or a place near it, such as a school, market or church.
        </li>
        <li>
          <strong>By browsing.</strong>
          {' '}
          Choose your state, then your LGA, your ward and your polling unit. This works without JavaScript.
        </li>
      </ol>
      <SourceLine id="inec-pu-locator" what="States, LGAs, wards, polling units and their codes" />

      <h2>Check it is yours</h2>
      <p>
        When you choose a polling unit, your ballot names it at the top. Check it is the polling unit where you registered. Each ballot also links
        to the same polling unit’s ballot for the other election day.
      </p>

      <h2>Not sure where you are registered?</h2>
      <p>
        Use INEC’s own
        {' '}
        <a href={INEC_LOCATOR}>Polling Unit Locator</a>
        , or ask at your INEC local government office.
      </p>

      <h2>What you type stays with you</h2>
      <p>The code or name you type is matched in your browser. It is never sent to this site or anyone else.</p>
      <p className="go"><a className="btn btn-secondary" href="/about/">About this site</a></p>
    </>
  )
}
