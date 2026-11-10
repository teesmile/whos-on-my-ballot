import type { Metadata } from 'next'

import { NOT_PROVIDED } from '@/components/Candidate'
import { JsonLd } from '@/components/JsonLd'
import { SourceLine } from '@/components/SourceLine'
import { pageGraph, pageMeta } from '@/lib/seo'
import { BUILT_BY, CORRECTIONS_EMAIL } from '@/lib/site'

const TITLE = 'About: how this site reads INEC’s lists'
export const metadata: Metadata = pageMeta({
  title: 'How this site reads INEC’s candidate lists', path: '/about/',
  description: 'Where every fact on this site comes from, how INEC’s lists are shown, how candidates are ordered, corrections and privacy.',
})

export default function About() {
  return (
    <>
      <JsonLd data={pageGraph('/about/', TITLE, [['Home', '/'], ['About', '/about/']])} />
      <h1>About this site</h1>
      <p className="lead">
        A free, independent and non-partisan guide to Nigeria’s 2027 elections. Tell it where you will vote, and it shows every race on your
        ballot with every candidate side by side, from INEC’s published lists.
      </p>

      <h2>Where the information comes from</h2>
      <p>Every fact on this site comes from a published document, and each one is cited next to it with a link and the date it was retrieved.</p>
      <SourceLine id="president" what="Candidates for President, Senate and House of Representatives" />
      <SourceLine id="governor-abia" what="Candidates for Governor" />
      <SourceLine id="sha-2026-10-10" what="Candidates for the State Houses of Assembly" />
      <SourceLine id="inec-parties" what="Full party names" />
      <SourceLine id="inec-pu-locator" what="States, LGAs, wards and polling units" />
      <SourceLine id="inec-constituencies-workbook" what="Which constituencies each LGA and ward is in" />
      <SourceLine id="inec-irev-2023-assembly" what="Which State Assembly constituency each ward was in at the 2023 elections" />
      <p>For Niger’s House of Representatives races, INEC’s latest list is from 12 September 2026, and those pages say so.</p>

      <h2>How INEC’s lists are shown</h2>
      <ul>
        <li>Names, ages, qualifications and remarks appear exactly as INEC prints them. Spellings are never corrected; only a newer INEC document changes them.</li>
        <li>Where INEC’s list appears to contain a printing error, the value is shown as printed with the note “As printed in INEC’s list; this appears to be an error.”</li>
        <li>{`Where INEC gives no value, every candidate’s page shows the same words: “${NOT_PROVIDED}”.`}</li>
        <li>Every candidate has the same fields and the same layout.</li>
      </ul>

      <h2>The order of candidates</h2>
      <p>
        Within each race, candidates are listed in the order of INEC’s final lists: alphabetical by party acronym. INEC has not published the
        2027 ballot-paper order. If it does, this site will follow it.
      </p>

      <h2>What this site never does</h2>
      <p>
        No rankings, predictions, polls, endorsements or opinions. No party colours, logos or candidate photos. No candidate is featured or
        given more space than another.
      </p>

      <h2>Background for presidential candidates</h2>
      <p>
        Only the presidential race has a background section, and it is shown for every presidential candidate and running mate or for none of
        them. Each entry cites an official record or an independent source; Wikipedia is never used.
      </p>

      <h2>When INEC’s documents don’t settle your race</h2>
      <p>
        For a few areas, INEC’s published documents don’t say which constituency each polling unit is in. Those ballots show every possible
        race, say so plainly, and link to INEC’s own tools.
        {' '}
        <a href="/about/state-assembly-wards/">Why some wards show more than one State Assembly race</a>
      </p>

      <h2>Finding your polling unit</h2>
      <p><a href="/about/find-your-polling-unit/">How to find your polling unit from your voter card</a></p>

      <h2>Corrections</h2>
      <p>
        Every candidate page has a “Report a correction” link. You can also write to
        {' '}
        <a href={`mailto:${CORRECTIONS_EMAIL}`}>{CORRECTIONS_EMAIL}</a>
        . Accepted corrections are listed in the
        {' '}
        <a href="/corrections/">corrections log</a>
        , each with the source that settled it.
      </p>

      <h2>Privacy</h2>
      <p>
        This site asks only where you will vote. It never asks for your name, voter number or phone number, and it never looks you up in INEC’s
        register. What you type is matched in your browser and never sent anywhere. There is no tracking, no analytics, no cookies, no ads and
        no accounts.
      </p>
      <p>
        The pages are served by Vercel, which receives each request (including your IP address) in order to deliver the page.
        {' '}
        <a href="https://vercel.com/legal/privacy-policy">Vercel’s privacy policy</a>
        {' '}
        explains what it records.
      </p>

      <h2>Independence</h2>
      <p>This is an independent project. It is not affiliated with or endorsed by INEC (Independent National Electoral Commission).</p>
      <p className="credit">
        Built by
        {' '}
        <a href={BUILT_BY.url}>{BUILT_BY.name}</a>
      </p>
    </>
  )
}
