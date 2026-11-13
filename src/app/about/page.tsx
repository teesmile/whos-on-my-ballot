import type { Metadata } from 'next'

import { formatDate, NOT_PROVIDED } from '@/components/Candidate'
import { JsonLd } from '@/components/JsonLd'
import { StateGroupCite } from '@/components/RaceSection'
import { SourceLine } from '@/components/SourceLine'
import { allPhotos, candidate, firstGroup } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'
import { CORRECTIONS_EMAIL } from '@/lib/site'

const TITLE = 'About: how this site reads INEC’s lists'

/** "A", "A and B", "A, B and C". */
const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
export const metadata: Metadata = pageMeta({
  title: 'How this site reads INEC’s candidate lists', path: '/about/',
  description: 'Where every fact on this site comes from, how INEC’s lists are shown, how candidates are ordered, corrections and privacy.',
})

export default function About() {
  const fg = firstGroup()
  const states = Object.entries(fg.states).sort(([a], [b]) => a.localeCompare(b))
  const photos = Object.entries(allPhotos())
  return (
    <div className="about-page">
      <JsonLd data={pageGraph('/about/', TITLE, [['Home', '/'], ['About', '/about/']])} />
      <h1>About this site</h1>
      <p className="lead">
        A free, independent and non-partisan guide to Nigeria’s 2027 elections. Tell it where you will vote, and it shows every race on your
        ballot with every candidate side by side, from INEC’s published lists.
      </p>

      <h2>Where the information comes from</h2>
      <p>
        Every fact on this site comes from a published document, cited with a link and the date it was retrieved: next to the fact, or,
        on a candidate’s page, by a small number that leads to that page’s list of sources.
      </p>
      <SourceLine id="president" what="Candidates for President, Senate and House of Representatives" />
      <SourceLine id="governor-abia" what="Candidates for Governor" />
      <SourceLine id="sha-2026-10-10" what="Candidates for the State Houses of Assembly" />
      <SourceLine id="inec-parties" what="Full party names and party logos" />
      <SourceLine id="inec-pu-locator" what="States, LGAs, wards and polling units" />
      <SourceLine id="inec-constituencies-workbook" what="Which constituencies each LGA and ward is in" />
      <SourceLine id="inec-irev-2023-assembly" what="Which State Assembly constituency each ward was in at the 2023 elections" />
      <SourceLine id="constitution-1999" what="Four-year terms (the note on the home and election-day pages): sections 64(1), 105(1), 135(2) and 180(2)" />
      <p>For Niger’s House of Representatives races, INEC’s latest list is from 12 September 2026, and those pages say so.</p>

      <h2>How INEC’s lists are shown</h2>
      <ul>
        <li>Names, ages, qualifications and remarks appear exactly as INEC prints them. Spellings are never corrected; only a newer INEC document changes them.</li>
        <li>Where INEC’s list appears to contain a printing error, the value is shown as printed with the note “As printed in INEC’s list; this appears to be an error.”</li>
        <li>{`Where INEC gives no value, every candidate’s page shows the same words: “${NOT_PROVIDED}”.`}</li>
        <li>Every candidate has the same fields and the same layout.</li>
      </ul>

      <h2 id="order">The order of candidates</h2>
      <p>
        {`Each race shows two groups. First, the five parties with the most candidates in 2027 (${fg.parties.join(', ')}), alphabetical by acronym. `}
        {'They come from one published measure, not a choice: how many candidates each party fields across all 2027 races, counted from INEC’s final lists. A party with no candidate in a race is simply absent from it. '}
        {'Then all other parties, in ballot order. INEC has not published the 2027 ballot-paper order, so that is the order of INEC’s lists, alphabetical by acronym; if INEC publishes it, this site will follow it.'}
      </p>
      <p className="quiet">{`Candidates fielded: ${fg.measure_values.map(m => `${m.acronym} ${m.value.toLocaleString('en-GB')}`).join(', ')}.`}</p>
      {fg.sources.map(src => (
        <p className="cite" key={src.url} data-source="first-group">
          <a href={src.url}>
            {`The five parties: ${src.title}, retrieved `}
            <time dateTime={src.retrieved}>{formatDate(src.retrieved)}</time>
          </a>
        </p>
      ))}
      <p id="order-states">
        {'One exception, in every race except President: where the party that won a state’s last governorship election, as declared by INEC, is not among the five and has candidates in that state, it joins the five there. '}
        {'It replaces whichever of the five has the fewest candidates in that state; if two tie, the one with fewer candidates nationally goes. '}
        {`This applies in ${states.length === 1 ? 'one state' : `${states.length} states`}: ${listJoin(states.map(([, st]) => `${st.state_name} (${st.joins} replaces ${st.replaces})`))}. The FCT has no governorship election and keeps the five.`}
      </p>
      {states.map(([key, st]) => <StateGroupCite key={key} st={st} />)}

      <h2>What this site never does</h2>
      <p>
        {'No rankings, predictions, polls, endorsements or opinions. Photos only for presidential candidates, as described below. '}
        Party colours and marks appear only inside each
        party’s official logo from INEC’s register, the same size for every party, never in the site’s own design. No candidate is featured
        or given more space than another.
      </p>

      <h2>Background for presidential candidates</h2>
      <p>
        Only the presidential race has a background section, and it is shown for every presidential candidate and running mate or for none of
        them. It lists roles and dates only, newest first, with no summary in our own words. Each entry is numbered to an official record or an
        independent source in the page’s list of sources; Wikipedia is never used.
      </p>
      <h2 id="photos">Photos</h2>
      <p>
        Only presidential candidates have a photo, taken from the candidate’s own official account, their campaign or party website, or
        Wikimedia Commons, never from a news site or agency, with the same head-and-shoulders crop and size for all, and each
        one approved by the site’s owner before it appears. Their credits are listed at the end of this page. Every other candidate,
        and any presidential candidate without a suitable photo, shows the same plain placeholder. A candidate or party can send an official
        photo to
        {' '}
        <a href={`mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent('Official photo')}`}>{CORRECTIONS_EMAIL}</a>
        ; the same address takes any request to change a photo.
      </p>

      <h2>When INEC’s documents don’t settle your race</h2>
      <p>
        For a few areas, INEC’s published documents don’t say which constituency each polling unit is in. Those ballots show every possible
        race, say so plainly, and link to INEC’s own tools.
        {' '}
        <a href="/about/state-assembly-wards/">Why some wards show more than one State Assembly race</a>
      </p>

      <h2>Finding your polling unit</h2>
      <p className="go"><a className="btn" href="/about/find-your-polling-unit/">How to find your polling unit from your voter card</a></p>

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
        register. What you type is matched in your browser and never sent anywhere. The site sets no cookies, runs no tracking or analytics, and has
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
      <p>Not affiliated with INEC.</p>

      {photos.length > 0 && (
        <>
          <h2 id="photo-credits">Photo credits</h2>
          <ul className="photo-credits">
            {photos.map(([id, p]) => (
              <li key={id} id={`credit-${id}`}>
                <strong>{candidate(id).c.candidate.name}</strong>
                {` (${candidate(id).c.party}): `}
                <a href={p.file_page}>{p.source}</a>
                {p.author && `, by ${p.author}`}
                {p.licence && p.licence_url && (
                  <>
                    {', licensed under '}
                    <a href={p.licence_url}>{p.licence}</a>
                  </>
                )}
                {`; cropped to a square for this site. Retrieved ${formatDate(p.retrieved)}.`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
