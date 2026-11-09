import { type Race, source } from '@/lib/data'

import { Candidate, formatDate } from './Candidate'

const WORKBOOK = 'inec-constituencies-workbook'
export const INEC_LOCATOR = 'https://cvr.inecnigeria.org/pu'
export const INEC_2027 = 'https://www.inecnigeria.org/elections/2027-general-elections-update'

export function raceTitle(r: Race): string {
  if (r.office === 'president') return 'President'
  return `${r.office === 'senate' ? 'Senate' : 'House of Representatives'}: ${r.name}`
}

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
      {r.sources.map((id) => {
        const s = source(id)
        return (
          <p className="cite" key={id}>
            Source:
            {' '}
            <a href={s.page_url ?? s.file_url}>{s.title}</a>
            , retrieved
            {' '}
            <time dateTime={s.retrieved_at.slice(0, 10)}>{formatDate(s.retrieved_at)}</time>
          </p>
        )
      })}
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
          <p className="cite">
            Source:
            {' '}
            <a href={wb.archive_url ?? wb.file_url}>{wb.title}</a>
            , retrieved
            {' '}
            <time dateTime={wb.retrieved_at.slice(0, 10)}>{formatDate(wb.retrieved_at)}</time>
          </p>
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
          <Candidate key={c.id} c={c} src={source(c.provenance.source_id)} ticket={r.office === 'president'} level={level === 2 ? 3 : 4} />
        ))}
      </ul>
    </section>
  )
}

/** Several races where INEC hasn't published which one applies to the voter's polling unit (owner ruling D-021). */
export function UnresolvedGroup({ office, list }: { office: 'Senate' | 'House of Representatives', list: Race[] }) {
  return (
    <section className="race-group unresolved" aria-labelledby={`group-${office}`}>
      <h2 id={`group-${office}`}>
        {office}
        : one of these is on your ballot
      </h2>
      <div className="note">
        <p>
          INEC has not published which of these
          {' '}
          {list.length}
          {' '}
          races applies to each polling unit in your area, so all of them are shown. Only one will be on your ballot paper.
        </p>
        <p>
          INEC’s own tools:
          {' '}
          <a href={INEC_LOCATOR}>INEC Polling Unit Locator</a>
          {' · '}
          <a href={INEC_2027}>INEC 2027 general elections page</a>
        </p>
      </div>
      {list.map(r => <RaceSection key={r.id} r={r} level={3} />)}
    </section>
  )
}
