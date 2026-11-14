/**
 * What a race's share picture and caption say: the same rules for every race (the working rules §1).
 * Shared by the build (link-preview cards, the data each share button carries) and nothing else; no I/O here.
 */
import type { Candidate, Race } from './data'

export const ELECTION_DAY: Record<string, string> = { 'jan-2027': '16 January 2027', 'feb-2027': '6 February 2027' }
export const NO_CANDIDATE = 'No candidate named'

export const OFFICE_TITLE: Record<Race['office'], string> = {
  president: 'President',
  senate: 'Senate',
  house: 'House of Representatives',
  governor: 'Governor',
  state_assembly: 'State House of Assembly',
}

export function raceTitle(r: Pick<Race, 'office' | 'name'>): string {
  if (r.office === 'president') return 'President'
  return `${OFFICE_TITLE[r.office]}: ${r.name}`
}

/** Where a race is, for the share picture: the constituency and its state as INEC prints them; just the state for a
 *  governorship; nothing for President. */
export function racePlace(r: Pick<Race, 'office' | 'name' | 'state'>): string {
  if (r.office === 'president') return ''
  const state = r.state ?? ''
  if (!r.name || r.name === state) return state
  return state ? `${r.name}, ${state}` : r.name
}

/** A ticket with no named candidate keeps its place, with INEC's remark verbatim. */
export function noCandidateText(c: Pick<Candidate, 'remarks'>): string {
  return c.remarks ? `${NO_CANDIDATE} - INEC remark: ${c.remarks}` : NO_CANDIDATE
}

/** Candidates INEC names in a race (a row with no name is a ticket, not a candidate). */
export const namedCount = (r: Race) => r.candidates.filter(c => c.candidate.name).length

export interface Picture {
  /** "President - 16 January 2027" (the link-preview card's one line) */
  title: string
  /** The share picture's top band: the office, where (the constituency and state, as INEC prints them; '' for President), the date. */
  office: string
  place: string
  date: string
  /** [acronym, name as INEC prints it or the no-candidate text, candidate id, the photo's share copy or ''] */
  tiles: [string, string, string, string][]
  /** How many more candidates the race has beyond the tiles (0: every candidate is shown). */
  more: number
}

/**
 * Six tiles: the race's members of the first group (D-042) in display order, then one saying how many more candidates
 * there are. A race with six tickets or fewer shows them all and no count.
 */
export function picture(r: Race, slotOf: (c: Candidate) => string = () => ''): Picture {
  const title = `${raceTitle(r)} - ${ELECTION_DAY[r.election]}`
  const top = { office: OFFICE_TITLE[r.office], place: racePlace(r), date: ELECTION_DAY[r.election] }
  const tile = (c: Candidate): [string, string, string, string] => [c.party, c.candidate.name || noCandidateText(c), c.id, slotOf(c)]
  if (r.candidates.length <= 6) return { title, ...top, tiles: r.candidates.map(tile), more: 0 }
  const shown = r.candidates.filter(c => c.display_group === 'first').slice(0, 5)
  const shownNamed = shown.filter(c => c.candidate.name).length
  return { title, ...top, tiles: shown.map(tile), more: namedCount(r) - shownNamed }
}

/** The caption sent with every share (owner's wording, 11 Nov 2026): the same words for every race and candidate, no year.
 *  The full address follows it on the next line. */
export const CAPTION = 'Check who is on your ballot:'
export const caption = () => CAPTION
