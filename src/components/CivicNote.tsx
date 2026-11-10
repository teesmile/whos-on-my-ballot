import { source } from '@/lib/data'

/**
 * The owner's civic note (D-034): a deliberate, owner-approved exception to the no-opinion rule, limited to this exact text on
 * the home and election-day pages (and the pre-launch holding page). It names no candidate, party or movement. Its one fact,
 * the four-year term, links to the Constitution; the sections and retrieval date are in the about page's sources (D-038).
 */
export const CIVIC_NOTE = 'Whoever wins will serve four years. Don’t sell your vote. Vote your conscience. Vote for competence.'

/** A small "opens elsewhere" mark: inline, drawn in the text colour, hidden from screen readers (the link says it in words). */
export function ExternalIcon() {
  return (
    <svg className="ext" aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="12" height="12">
      <path d="M5 2H2v8h8V7M7 2h3v3M10 2 5.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function CivicNote() {
  const s = source('constitution-1999')
  return (
    <section className="civic-note" aria-label="A note to voters">
      <p data-civic-note>
        {CIVIC_NOTE}
        {' '}
        <a href={s.page_url ?? s.file_url} target="_blank" rel="noopener noreferrer" data-source="constitution-1999">
          (1999 Constitution)
          <ExternalIcon />
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </p>
    </section>
  )
}
