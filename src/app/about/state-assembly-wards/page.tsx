import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { INEC_2027, INEC_LOCATOR } from '@/components/RaceSection'
import { SourceLine } from '@/components/SourceLine'
import { shaMappingStats } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'

const TITLE = 'Why some wards show more than one Assembly race'
const n = (x: number) => x.toLocaleString('en-NG')

export const metadata: Metadata = pageMeta({
  title: TITLE, path: '/about/state-assembly-wards/',
  description: 'How this site decides which State House of Assembly race is on your 6 February 2027 ballot, and why some areas show more than one.',
})

export default function StateAssemblyWards() {
  const s = shaMappingStats()
  const share = ((100 * s.pusSeveral) / s.pusAll).toFixed(1)
  return (
    <>
      <JsonLd data={pageGraph('/about/state-assembly-wards/', TITLE, [['Home', '/'], ['About', '/about/'], [TITLE, '/about/state-assembly-wards/']])} />
      <nav aria-label="Breadcrumb" className="crumbs"><a href="/about/">About</a></nav>
      <h1>{TITLE}</h1>
      <p className="lead">
        On 6 February 2027 you vote for one member of your State House of Assembly: the one for your state constituency. Only one State Assembly
        race will be on your ballot paper.
      </p>

      <h2>Which documents decide it</h2>
      <ol>
        <li>
          {`INEC’s 2027 list names ${n(s.constituencies)} State Assembly constituencies in ${s.statesWithList} states, with their candidates.`}
          <SourceLine id="sha-2026-10-10" what="State Assembly constituencies and candidates" />
        </li>
        <li>
          INEC’s constituency workbook says which wards are in each constituency. For some constituencies it says only “Part of the LGA”, and some
          constituencies on the 2027 list are not in it.
          <SourceLine id="inec-constituencies-workbook" what="Which wards are in each constituency" />
        </li>
        <li>
          INEC’s Result Viewing Portal (IReV) shows which constituency each ward was in at the 18 March 2023 elections. It is used only where the
          constituency names match the 2027 list exactly, and never where a constituency has been added since 2023.
          <SourceLine id="inec-irev-2023-assembly" what="Each ward’s constituency at the 2023 elections" />
        </li>
      </ol>

      <h2>What this site shows</h2>
      <ul>
        <li>Where those documents settle it, your ballot shows the one race.</li>
        <li>Where they don’t, it shows every race your polling unit could be in, says so plainly, and links to INEC’s own tools.</li>
        <li>Where INEC’s workbook and IReV give different constituencies, it shows both and says the two documents differ.</li>
      </ul>
      <p>This site never guesses a ward’s constituency from a similar name or from a map.</p>

      <h2>How many areas this affects</h2>
      <p>
        {`${n(s.one)} wards show one State Assembly race. ${n(s.several)} wards show more than one, covering ${share}% of polling units; in ${n(s.disagree)} of those, INEC’s two documents differ.`}
      </p>
      <p>
        INEC has not published a list of State House of Assembly candidates for Borno, so no Borno candidates can be shown. The FCT has no State
        House of Assembly.
      </p>

      <h2>If your ballot shows more than one race</h2>
      <p>
        Check with INEC’s
        {' '}
        <a href={INEC_LOCATOR}>Polling Unit Locator</a>
        , INEC’s
        {' '}
        <a href={INEC_2027}>2027 general elections page</a>
        , or your INEC local government office.
      </p>
      <p className="go"><a className="btn" href="/about/">About this site</a></p>
    </>
  )
}
