import { firstGroup, type Race, sharePhoto, source } from '@/lib/data'
import { slug } from '@/lib/core'
import { caption, ELECTION_DAY, namedCount, picture, raceTitle } from '@/lib/share'
import { raceCorrectionHref, shareLinks, SITE_URL } from '@/lib/site'

import { CandidateCard } from './Candidate'
import { Share, WhatsAppGlyph } from './Share'
import { SourceLine } from './SourceLine'

export { raceTitle }

const WORKBOOK = 'inec-constituencies-workbook'
export const INEC_LOCATOR = 'https://cvr.inecnigeria.org/pu'
export const INEC_2027 = 'https://www.inecnigeria.org/elections/2027-general-elections-update'
export const REST_LABEL = 'All other parties, in ballot order'

/** Races run on a ticket, and what INEC calls the second person on it. */
export const TICKET_OFFICES: Race['office'][] = ['president', 'governor']
export const mateLabel = (r: Race) => (r.office === 'governor' ? 'Deputy governor' : 'Running mate')

function SourcesNote({ r }: { r: Race }) {
  const fallback = r.sources.includes('house-2026-09-12-consolidated')
  return (
    <div className="race-meta">
      {fallback && (
        <p className="note">
          Latest INEC list for this state: 12 September 2026. INEC’s 31 October 2026 update did not include a House of Representatives list for Niger.
        </p>
      )}
      {r.sources.map(id => <SourceLine key={id} id={id} what="Candidates" />)}
      <SourceLine id="inec-parties" what="Full party names and logos" />
    </div>
  )
}

function PlacementNotes({ r }: { r: Race }) {
  if (!r.placement_notes.length) return null
  const wb = source(WORKBOOK)
  return (
    <div className="placement" data-workbook={wb.source_id}>
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

/** Where a race's results will be: the president and governors on the results page. */
export function resultsHref(r: Race): string {
  return r.office === 'president' ? '/results/#president' : `/results/governor/${slug(r.state ?? '')}/`
}

/** Races with a results page (owner decision, 11 Nov 2026): the president and the governors. */
export const RESULTS_OFFICES: Race['office'][] = ['president', 'governor']
export const WINNER_LINE = 'The declared winner will be shown here once INEC publishes its list of those elected.'

/**
 * Under every race: when its results come. President and Governor: the date, and the results page. Senate, House and
 * State Assembly: the declared winner, once INEC publishes its list of those elected (a bulk import, like the candidates).
 */
function ResultsStrip({ r }: { r: Race }) {
  if (!RESULTS_OFFICES.includes(r.office)) {
    return <div className="results-strip"><p>{WINNER_LINE}</p></div>
  }
  return (
    <div className="results-strip">
      <p>{`Results for this race will appear from ${ELECTION_DAY[r.election]}.`}</p>
      <a className="btn btn-secondary btn-small" href={resultsHref(r)}>Results page</a>
    </div>
  )
}

/** "Share on WhatsApp" as a tile in the grid, on phones only: in the empty slot beside an odd first group, or as a full row. */
function WhatsAppTile({ r, url, row }: { r: Race, url: string, row: boolean }) {
  // No card or box: the words, and WhatsApp's glyph on a round button beneath them (owner feedback, 11 Nov 2026).
  const link = (
    <a href={shareLinks(caption(), url).whatsapp} data-share-wa aria-label={`Share on WhatsApp: ${raceTitle(r)}`}>
      <span className="wa-tile-text">Share on WhatsApp</span>
      <span className="wa-tile-button"><WhatsAppGlyph /></span>
    </a>
  )
  // In the grid's empty slot it is one more item of the grid; as a full row it sits under the list, not inside it.
  return row ? <div className="wa-tile wa-row" data-wa-tile>{link}</div> : <li className="wa-tile" data-wa-tile>{link}</li>
}

/**
 * One race: its candidates as a grid of cards in two labelled groups (owner decision D-042), a filter the page script
 * runs in the browser, when its results will appear, the share block and a correction button. `pageUrl` is the page's
 * own path (never a polling unit), for "Copy link" and corrections.
 */
export function RaceSection({ r, level = 2, pageUrl }: { r: Race, level?: 2 | 3, pageUrl: string }) {
  const H = level === 2 ? 'h2' : 'h3'
  const G = level === 2 ? 'h3' : 'h4'
  const titleId = `race-${r.id}`
  const fg = firstGroup()
  const first = r.candidates.filter(c => c.display_group === 'first')
  const rest = r.candidates.filter(c => c.display_group === 'rest')
  const mate = TICKET_OFFICES.includes(r.office) ? mateLabel(r) : null
  const n = namedCount(r)
  // Sharing a race shares the home page, so whoever opens it picks their own place; "Copy link" copies this page.
  const url = `${SITE_URL}/`
  // The tile goes under the first group, or under the only group when the race has none of the five.
  const tileAfter = first.length ? 'first' : 'rest'
  const groups = [[fg.label, first, 'first'], [REST_LABEL, rest, 'rest']] as const
  return (
    <section className="race" data-race-id={r.id} aria-labelledby={titleId}>
      <H id={titleId} className="band">{raceTitle(r)}</H>
      <p className="race-count">{`${n} ${n === 1 ? 'candidate' : 'candidates'}`}</p>
      <SourcesNote r={r} />
      <PlacementNotes r={r} />
      <div className="filter js-only" data-filter>
        <label htmlFor={`filter-${r.id}`}>Find a party or candidate in this race</label>
        <input id={`filter-${r.id}`} type="search" autoComplete="off" spellCheck={false} />
        <p className="filter-none" role="status" />
      </div>
      {groups.map(([label, list, key]) => list.length > 0 && (
        <div className="group" key={key} data-group-of={key}>
          <G className="group-label">{label}</G>
          <ul className="cards" aria-label={`${label}: ${raceTitle(r)}`}>
            {list.map(c => <CandidateCard key={c.id} c={c} mateLabel={mate} />)}
            {key === tileAfter && list.length % 2 === 1 && <WhatsAppTile r={r} url={url} row={false} />}
          </ul>
          {key === tileAfter && list.length % 2 === 0 && <WhatsAppTile r={r} url={url} row />}
        </div>
      ))}
      <p className="order-note">
        <a href="/about/#order">How the order is set</a>
        . INEC has not published the 2027 ballot-paper order, so ballot order here is INEC’s list order: alphabetical by party acronym.
      </p>
      <ResultsStrip r={r} />
      <Share
        label={`Share this race: ${raceTitle(r)}`}
        url={url}
        copyUrl={`${SITE_URL}${pageUrl}`}
        picture={picture(r, sharePhoto)}
        level={level === 2 ? 3 : 4}
      />
      <p className="correct-row">
        <a className="btn btn-secondary" href={raceCorrectionHref(r.id, `${SITE_URL}${pageUrl}`, raceTitle(r))}>Report a correction</a>
      </p>
    </section>
  )
}

/** Several races where INEC hasn't published which one applies to the voter's polling unit (owner ruling D-021). */
export function UnresolvedGroup({ office, list, path }: { office: 'Senate' | 'House of Representatives' | 'State House of Assembly', list: Race[], path: string }) {
  return (
    <section className="race-group unresolved" aria-labelledby={`group-${slugId(office)}`}>
      <h2 id={`group-${slugId(office)}`} className="band">
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
        {office === 'State House of Assembly' && <p className="go"><a className="btn btn-secondary" href="/about/state-assembly-wards/">Why some wards show more than one State Assembly race</a></p>}
        <p>INEC’s own tools:</p>
        <ul className="link-list tiles">
          <li><a href={INEC_LOCATOR}>INEC Polling Unit Locator</a></li>
          <li><a href={INEC_2027}>INEC 2027 general elections page</a></li>
        </ul>
      </div>
      {list.map(r => <RaceSection key={r.id} r={r} level={3} pageUrl={path} />)}
    </section>
  )
}

function slugId(text: string) {
  return text.toLowerCase().replace(/[^a-z]+/g, '-')
}

export interface TabPanel { key: string, label: string, title: string, badge: string, badgeLong: string, content: React.ReactNode }

/**
 * The races on a ballot. Without JavaScript: a bar of links to each race, and the races one after another, each ending in
 * a link to the next. The page script turns the bar into tabs (one race at a time, the choice kept in the address).
 */
export function RaceTabs({ panels }: { panels: TabPanel[] }) {
  return (
    <>
      <nav aria-label="Races on this ballot" className="race-tabs" data-tabs>
        <ul>
          {panels.map(p => (
            <li key={p.key}>
              <a href={`#${p.key}`} data-tab={p.key}>
                {/* The same short form for every tab on a phone; screen readers hear the full name. */}
                <span className="tab-name" aria-hidden={p.label !== p.title || undefined}>{p.label}</span>
                {p.label !== p.title && <span className="visually-hidden">{p.title}</span>}
                {' '}
                <span className="tab-count">
                  {p.badge}
                  <span className="visually-hidden">{` ${p.badgeLong}`}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {panels.map((p, i) => (
        <div className="tab-panel" id={p.key} key={p.key} data-panel={p.key}>
          {p.content}
          {panels[i + 1] && (
            <p className="next">
              <a className="btn btn-next" href={`#${panels[i + 1].key}`} data-next={panels[i + 1].key}>{`Next: ${panels[i + 1].title}`}</a>
            </p>
          )}
        </div>
      ))}
    </>
  )
}

/** The tab badge for a panel holding one race, or several possible races. */
export function badgeFor(list: Race[]): { badge: string, badgeLong: string } {
  if (list.length === 1) {
    const n = namedCount(list[0])
    return { badge: String(n), badgeLong: n === 1 ? 'candidate' : 'candidates' }
  }
  return { badge: String(list.length), badgeLong: 'possible races, one is on your ballot' }
}
