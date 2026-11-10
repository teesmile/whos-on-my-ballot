import { SourceLine } from './SourceLine'

/**
 * The owner's civic note (D-034): a deliberate, owner-approved exception to the no-opinion rule, limited to this exact text on
 * the home and election-day pages (and the pre-launch holding page). It names no candidate, party or movement. Its one fact,
 * the four-year term, is cited to the Constitution.
 */
export const CIVIC_NOTE = 'Whoever wins will serve four years. Don’t sell your vote. Vote your conscience. Vote for competence.'

export function CivicNote() {
  return (
    <section className="civic-note" aria-label="A note to voters">
      <p data-civic-note>{CIVIC_NOTE}</p>
      <SourceLine id="constitution-1999" what="Four-year terms: sections 64(1), 105(1), 135(2) and 180(2)" />
    </section>
  )
}
