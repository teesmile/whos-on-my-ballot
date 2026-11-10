import { type Race, source } from '@/lib/data'

import { Candidate } from './Candidate'
import { SourceLine } from './SourceLine'

const WORKBOOK = 'inec-constituencies-workbook'
export const INEC_LOCATOR = 'https://cvr.inecnigeria.org/pu'
export const INEC_2027 = 'https://www.inecnigeria.org/elections/2027-general-elections-update'

const OFFICE_TITLE: Record<Race['office'], string> = {
  president: 'President',
  senate: 'Senate',
  house: 'House of Representatives',
  governor: 'Governor',
  state_assembly: 'State House of Assembly',
}

export function raceTitle(r: Race): string {
  if (r.office === 'president') return 'President'
  return `${OFFICE_TITLE[r.office]}: ${r.name}`
}

/** Races run on a ticket, and what INEC calls the second person on it. */
export const TICKET_OFFICES: Race['office'][] = ['president', 'governor']
export const mateLabel = (r: Race) => (r.office === 'governor' ? 'Deputy governor' : 'Running mate')

function SourcesNote({ r }: { r: Race }) {
  const fallback = r.sources.includes('house-2026-09-12-consolidated')
  return (
    <div className="race-meta">
      <p>
        Candidates are listed in the order of INEC’s list: alphabetical by party acronym. INEC has not published the 2027 ballot-paper order.
      </p>
      {fallback && (
        <p className="note">
          Latest INEC list for this state: 12 September 2026. INEC’s 31 October 2026 update did not include a House of Representatives list for Niger.
        </p>
      )}
      <SourceLine id="inec-parties" what="Full party names" />
      {r.sources.map(id => <SourceLine key={id} id={id} what="Candidates" />)}
    </div>
  )
}

function PlacementNotes({ r }: { r: Race }) {
  if (!r.placement_notes.length) return null
  const wb = source(WORKBOOK)
  return (
    <div className="placement">
      {r.placement_notes.map(n => (
        <div className="note" key={n.lga}>
          <p>
            <strong>{n.kind === 'inferred' ? `Inferred placement: ${n.lga} LGA.` : `Unconfirmed placement: ${n.lga} LGA.`}</strong>
            {' '}
            {n.reason}
          </p>
          <p>
            INEC’s text (row
            {' '}
            {n.row}
            ):
            {' '}
            <q>{n.inec_text}</q>
          </p>
          <SourceLine id={WORKBOOK} what={`INEC’s text, row ${n.row}`} />
        </div>
      ))}
    </div>
  )
}

export function RaceSection({ r, level = 2 }: { r: Race, level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3'
  const titleId = `race-${r.id}`
  return (
    <section className="race" data-race-id={r.id} aria-labelledby={titleId}>
      <H id={titleId}>{raceTitle(r)}</H>
      <SourcesNote r={r} />
      <PlacementNotes r={r} />
      <ul className="candidates" aria-label={`Candidates: ${raceTitle(r)}`}>
        {r.candidates.map(c => (
          <Candidate key={c.id} c={c} src={source(c.provenance.source_id)} ticket={TICKET_OFFICES.includes(r.office)} mateLabel={mateLabel(r)} level={level === 2 ? 3 : 4} />
        ))}
      </ul>
    </section>
  )
}

/** Several races where INEC hasn't published which one applies to the voter's polling unit (owner ruling D-021). */
export function UnresolvedGroup({ office, list }: { office: 'Senate' | 'House of Representatives' | 'State House of Assembly', list: Race[] }) {
  return (
    <section className="race-group unresolved" aria-labelledby={`group-${slugId(office)}`}>
      <h2 id={`group-${slugId(office)}`}>
        {office}
        : one of these is on your ballot
      </h2>
      <div className="note">
        <p>
          {office === 'State House of Assembly' ? 'INEC’s published documents don’t settle which of these' : 'INEC has not published which of these'}
          {' '}
          {list.length}
          {' '}
          races applies to each polling unit in your area, so all of them are shown. Only one will be on your ballot paper.
        </p>
        <p>INEC’s own tools:</p>
        <ul className="link-list">
          <li><a href={INEC_LOCATOR}>INEC Polling Unit Locator</a></li>
          <li><a href={INEC_2027}>INEC 2027 general elections page</a></li>
        </ul>
      </div>
      {list.map(r => <RaceSection key={r.id} r={r} level={3} />)}
    </section>
  )
}

function slugId(text: string) {
  return text.toLowerCase().replace(/[^a-z]+/g, '-')
}
