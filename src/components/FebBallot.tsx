import { type FebBallotSpec, race } from '@/lib/data'
import { SITE_URL } from '@/lib/site'

import { INEC_2027, RaceSection, raceTitle, UnresolvedGroup } from './RaceSection'
import { Share } from './Share'
import { SourceLine } from './SourceLine'

/** Identical wording for every state without a governorship race on 6 February (the working rules §1). */
export const noGovernorText = (state: string) =>
  state === 'FCT'
    ? 'The FCT has no governor and no State House of Assembly, so there is no election in the FCT on 6 February 2027.'
    : `No governorship election in ${state} on 6 February 2027.`
export const NO_SHA_BORNO = 'INEC’s published list of State House of Assembly candidates (statutory notice, 31 October 2026) has no candidates for Borno.'

export function FebBallot({ b }: { b: FebBallotSpec }) {
  const st = b.state.name
  const sha = b.sha.map(race)
  const all = [...(b.governor ? [race(b.governor)] : []), ...sha]
  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        {' / '}
        <a href={`/state/${b.state.code}/`}>{st}</a>
      </nav>
      <h1>Your ballot for 6 February 2027</h1>
      <div className="pu-confirmed" data-lookup="confirm" data-election="feb" data-state={b.state.code} role="status" aria-live="polite" hidden />
      <p className="lead">
        {st}
        {' · '}
        Every race on this ballot, with every candidate as INEC listed them.
      </p>
      <SourceLine id="inec-pu-locator" what="Polling units and their wards and LGAs" />
      {b.sha.length > 0 && (
        <>
          <SourceLine id="inec-constituencies-workbook" what="Which State Assembly constituency each ward is in (with INEC’s 2027 list)" />
          <SourceLine id="inec-irev-2023-assembly" what="Which State Assembly constituency each ward was in at the 18 March 2023 elections" />
        </>
      )}
      {b.disagree && (
        <p className="note" data-sources-disagree>
          For some wards here, INEC’s constituency workbook and INEC’s Result Viewing Portal (2023) give different State Assembly constituencies, so both are shown.
        </p>
      )}
      {all.length > 0 && (
        <nav aria-label="Races on this ballot" className="toc">
          <ul>{all.map(r => <li key={r.id}><a href={`#race-${r.id}`}>{raceTitle(r)}</a></li>)}</ul>
        </nav>
      )}
      {b.governor
        ? <RaceSection r={race(b.governor)} />
        : (
            <section className="race" aria-labelledby="no-governor">
              <h2 id="no-governor">Governor</h2>
              <p className="note" data-no-governor>{noGovernorText(st)}</p>
              <SourceLine id="governor-abia" what="States with a governorship election on 6 February" />
            </section>
          )}
      {st === 'BORNO' && (
        <section className="race" aria-labelledby="no-sha">
          <h2 id="no-sha">State House of Assembly</h2>
          <p className="note" data-no-sha>{NO_SHA_BORNO}</p>
          <SourceLine id="sha-2026-10-10" what="State House of Assembly candidates" />
          <p><a href={INEC_2027}>INEC 2027 general elections page</a></p>
        </section>
      )}
      {sha.length === 1 && <RaceSection r={sha[0]} />}
      {sha.length > 1 && <UnresolvedGroup office="State House of Assembly" list={sha} />}
      {all.length > 0 && (
        <Share label="Share this ballot" text={`Every candidate on the 6 February 2027 ballot for ${sha.map(r => r.name).join(' or ') || st}, as listed by INEC:`} url={`${SITE_URL}${b.path}`} />
      )}
      <p><a href={`/state/${b.state.code}/`}>Not your polling unit? Search again</a></p>
    </>
  )
}
