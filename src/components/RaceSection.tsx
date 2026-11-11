import { firstGroup, type Race, source } from '@/lib/data'
import { caption, namedCount, picture, raceTitle } from '@/lib/share'
import { SITE_URL } from '@/lib/site'

import { CandidateCard } from './Candidate'
import { Share } from './Share'
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

/**
 * One race: its candidates as a grid of cards in two labelled groups (owner decision D-042), a filter the page script
 * runs in the browser, and the share block. `shareUrl` is the race's place on this page: never a polling unit.
 */
export function RaceSection({ r, level = 2, shareUrl, eager = false }: { r: Race, level?: 2 | 3, shareUrl: string, eager?: boolean }) {
  const H = level === 2 ? 'h2' : 'h3'
  const G = level === 2 ? 'h3' : 'h4'
  const titleId = `race-${r.id}`
  const fg = firstGroup()
  const first = r.candidates.filter(c => c.display_group === 'first')
  const rest = r.candidates.filter(c => c.display_group === 'rest')
  const mate = TICKET_OFFICES.includes(r.office) ? mateLabel(r) : null
  const n = namedCount(r)
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
      {[[fg.label, first, 'first'], [REST_LABEL, rest, 'rest']].map(([label, list, key]) => (list as typeof first).length > 0 && (
        <div className="group" key={key as string} data-group-of={key as string}>
          <G className="group-label">{label as string}</G>
          <ul className="cards" aria-label={`${label as string}: ${raceTitle(r)}`}>
            {(list as typeof first).map((c, i) => <CandidateCard key={c.id} c={c} mateLabel={mate} eager={eager && key === 'first' && i < 4} />)}
          </ul>
        </div>
      ))}
      <p className="order-note">
        <a href="/about/#order">How the order is set</a>
        . INEC has not published the 2027 ballot-paper order, so ballot order here is INEC’s list order: alphabetical by party acronym.
      </p>
      <Share
        label={`Share this race: ${raceTitle(r)}`}
        text={caption(r)}
        url={`${SITE_URL}${shareUrl}`}
        picture={picture(r)}
        level={level === 2 ? 3 : 4}
      />
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
        {office === 'State House of Assembly' && <p><a href="/about/state-assembly-wards/">Why some wards show more than one State Assembly race</a></p>}
        <p>INEC’s own tools:</p>
        <ul className="link-list tiles">
          <li><a href={INEC_LOCATOR}>INEC Polling Unit Locator</a></li>
          <li><a href={INEC_2027}>INEC 2027 general elections page</a></li>
        </ul>
      </div>
      {list.map(r => <RaceSection key={r.id} r={r} level={3} shareUrl={`${path}#race-${r.id}`} />)}
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
                <span className="tab-name">{p.label}</span>
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
  return { badge: `${list.length} races`, badgeLong: 'possible, one is on your ballot' }
}
