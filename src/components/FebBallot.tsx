import { type FebBallotSpec, febBallotTitle, race } from '@/lib/data'
import { pageGraph } from '@/lib/seo'

import { JsonLd } from './JsonLd'
import { badgeFor, INEC_2027, RaceSection, RaceTabs, type TabPanel, UnresolvedGroup } from './RaceSection'
import { SourceLine } from './SourceLine'

/** Identical wording for every state without a governorship race on 6 February (the working rules §1). */
export const noGovernorText = (state: string) =>
  state === 'FCT'
    ? 'The FCT has no governor and no State House of Assembly, so there is no election in the FCT on 6 February 2027.'
    : `No governorship election in ${state} on 6 February 2027.`
export const NO_SHA_BORNO = 'INEC has not published a list of State House of Assembly candidates for Borno. Its final list of 31 October 2026 covers the other 35 states with an assembly, so no Borno candidates can be shown here.'

export function FebBallot({ b }: { b: FebBallotSpec }) {
  const st = b.state.name
  const sha = b.sha.map(race)
  const gov = b.governor ? race(b.governor) : null
  const panels: TabPanel[] = []
  if (st !== 'FCT') {
    panels.push({
      key: 'governor', label: 'Governor', title: 'Governor',
      ...(gov ? badgeFor([gov]) : { badge: 'None', badgeLong: 'no election in this state' }),
      content: gov
        ? <RaceSection r={gov} shareUrl={`${b.path}#governor`} />
        : (
            <section className="race" aria-labelledby="no-governor">
              <h2 id="no-governor" className="band">Governor</h2>
              <p className="note" data-no-governor>{noGovernorText(st)}</p>
              <SourceLine id="governor-abia" what="States with a governorship election on 6 February" />
            </section>
          ),
    })
    panels.push({
      key: 'assembly', label: 'State Assembly', title: 'State House of Assembly',
      ...(sha.length ? badgeFor(sha) : { badge: 'None', badgeLong: 'no list published' }),
      content: st === 'BORNO'
        ? (
            <section className="race" aria-labelledby="no-sha">
              <h2 id="no-sha" className="band">State House of Assembly</h2>
              <p className="note" data-no-sha>{NO_SHA_BORNO}</p>
              <SourceLine id="sha-2026-10-10" what="State House of Assembly candidates" />
              <p className="go"><a className="btn btn-secondary" href={INEC_2027}>INEC 2027 general elections page</a></p>
            </section>
          )
        : sha.length === 1
          ? <RaceSection r={sha[0]} shareUrl={`${b.path}#assembly`} />
          : <UnresolvedGroup office="State House of Assembly" list={sha} path={b.path} />,
    })
  }
  return (
    <>
      <JsonLd data={pageGraph(b.path, febBallotTitle(b), [['Home', '/'], [st, `/state/${b.state.code}/`], [febBallotTitle(b), b.path]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        <span aria-hidden="true"> / </span>
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
      {panels.length > 0
        ? <RaceTabs panels={panels} />
        : (
            <section className="race" aria-labelledby="no-governor">
              <h2 id="no-governor" className="band">6 February 2027</h2>
              <p className="note" data-no-governor>{noGovernorText(st)}</p>
              <SourceLine id="governor-abia" what="States with a governorship election on 6 February" />
            </section>
          )}
      <p className="go"><a className="btn btn-secondary" href={`/state/${b.state.code}/`}>Not your polling unit? Search again</a></p>
    </>
  )
}
