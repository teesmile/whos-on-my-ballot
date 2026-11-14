/**
 * Build-time access to the pipeline's output in data/generated. Server-only: pages read it while being
 * rendered to static HTML. Nothing in this file reaches the browser.
 */
import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import { ballotPath, febBallotPath, slug, type StateSearchData } from './core'

const DIR = path.join(process.cwd(), 'data', 'generated')
const read = <T,>(rel: string): T => JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8')) as T

export interface BackgroundCitation {
  url: string
  publisher: string
  title: string
  published: string
  quote: string
  retrieved: string
}

export interface Background {
  identity: BackgroundCitation | null
  public_offices: { text: string, citations: BackgroundCitation[], note?: string | null }[]
  party_history: { text: string, citations: BackgroundCitation[], note?: string | null }[]
  researched: string
}

export interface Person {
  name: string
  age: number | null
  age_as_printed: string
  gender: 'M' | 'F' | null
  pwd: string
  qualifications: string
  position: string
  background: Background | null
}

export interface PrintingNote {
  person: 'candidate' | 'running_mate'
  field: string
  as_printed: string
}

export interface Candidate {
  id: string
  race_id: string
  party: string
  party_name: string | null
  /** Ballot-paper order (D-011). */
  ballot_position: number
  /** Owner decision D-042: one of the five parties shown first, or with all other parties in ballot order. */
  display_group: 'first' | 'rest'
  remarks: string
  candidate: Person
  running_mate: Person | null
  printing_notes: PrintingNote[]
  provenance: { source_id: string, page: number, sn: number }
}

export interface PlacementNote {
  lga: string
  kind: 'inferred' | 'unconfirmed'
  reason: string
  inec_text: string
  source_id: string
  row: number
}

export interface Race {
  id: string
  election: string
  office: 'president' | 'senate' | 'house' | 'governor' | 'state_assembly'
  state: string | null
  name: string
  workbook_code: string | null
  order_rule: string
  sources: string[]
  placement_notes: PlacementNote[]
  candidates: Candidate[]
}

export interface Source {
  source_id: string
  title: string
  file_url: string
  page_url?: string
  archive_url?: string
  retrieved_at: string
  pdf_created?: string | null
  pdf_modified?: string | null
}

interface Ward {
  code: string
  name: string
  federal_constituency: string[]
  senatorial_district: string[]
  mapping: 'exact' | 'unresolved'
  open_item: string | null
  state_constituency: string[]
  sc_mapping: 'exact' | 'unresolved' | 'none'
  sc_open_item: string | null
  sc_sources: string[]
  polling_units: { code: string, name: string }[]
}

export interface Lga { code: string, name: string, wards: Ward[] }
export interface StateGeo { code: string, name: string, source_id: string, lgas: Lga[] }
export interface StateRef { code: string, name: string }

let cache: {
  races: Race[]
  febRaces: Race[]
  raceById: Map<string, Race>
  sources: Map<string, Source>
  states: StateRef[]
  geo: Map<string, StateGeo>
} | null = null

function load() {
  if (cache) return cache
  const races = read<Race[]>('races/jan-2027.json')
  const febRaces = read<Race[]>('races/feb-2027.json')
  const sources = new Map(read<Source[]>('sources.json').map(s => [s.source_id, s]))
  const states = read<StateRef[]>('geo/states.json')
  const geo = new Map(states.map(s => [s.code, read<StateGeo>(`geo/${s.code}.json`)]))
  cache = { races, febRaces, raceById: new Map([...races, ...febRaces].map(r => [r.id, r])), sources, states, geo }
  return cache
}

export interface FirstGroup {
  measure: string
  label: string
  parties: string[]
  measure_values: { acronym: string, value: number }[]
  sources: { title: string, url: string, retrieved: string }[]
  /** D-070: the states whose last governorship winner joins the five, in every race there except President. */
  states: Record<string, StateGroup>
}
export interface StateGroup {
  parties: string[]
  joins: string
  replaces: string
  label: string
  state_name: string
  election_date: string
  since: string
  counts: Record<string, number>
  source: { title: string, url: string, retrieved: string, declared_by: string }
}
/** The five parties shown first in every race, and the published measure that picks them (D-042). */
export const firstGroup = (): FirstGroup => read<FirstGroup>('first-group.json')
/** A race's own first group: its state's (D-070) where the state's last governorship winner joins, else the national five. */
export function groupOf(r: Pick<Race, 'office' | 'state'>): { label: string, parties: string[], state: StateGroup | null } {
  const fg = firstGroup()
  const st = r.office !== 'president' && r.state ? fg.states[r.state] ?? null : null
  return st ? { label: st.label, parties: st.parties, state: st } : { label: fg.label, parties: fg.parties, state: null }
}

export interface Logo { png: string, full: string, full_width: number, full_height: number, source_url: string, retrieved_at: string }
let logos: Record<string, Logo> | null = null
/** Each party's logo from INEC's register (D-043): every party on a ballot has one, or the build fails. */
export function logo(party: string): Logo {
  logos ??= read<Record<string, Logo>>('logos.json')
  const l = logos[party]
  if (!l) throw new Error(`no INEC logo for ${party}`)
  return l
}
export const logoParties = () => { logos ??= read<Record<string, Logo>>('logos.json'); return Object.keys(logos) }
/** The same logo as a PNG data URL, for the build-time link-preview cards. */
export const logoPngDataUrl = (party: string) => `data:image/png;base64,${fs.readFileSync(path.join(DIR, logo(party).png)).toString('base64')}`
/** A file the pipeline wrote under data/generated (logos, the sprite, photos), for the routes that serve it. */
export const generatedBytes = (rel: string) => fs.readFileSync(path.join(DIR, rel))

/**
 * The page's one image (D-043, D-071): every party logo (a row of `cell`-pixel squares) and, under it, the approved photos of
 * the race the page shows first (a row of `photo_cell`-pixel squares at y = `photo_y`). `file` holds the President's photos,
 * `sheets` one image per governorship race with photos, `logo_file` the logos alone.
 */
export interface Sheet { file: string, width: number, height: number, bytes: number, photos: Record<string, number> }
export interface Sprite extends Sheet { logo_file: string, logo_width: number, logo_bytes: number, cell: number, photo_cell: number, photo_y: number, logos: Record<string, number>, sheets: Record<string, Sheet> }
export const sprite = (): Sprite => read<Sprite>('sprite.json')
/** The logos alone, in the same geometry. */
export function logosSheet(): Sheet {
  const s = sprite()
  return { file: s.logo_file, width: s.logo_width, height: s.cell, bytes: s.logo_bytes, photos: {} }
}
/**
 * The image a race's cards draw from, the same one its ballot page shows first, so a page makes one image request: the
 * President's for 16 January races; for 6 February races, the state's governorship image, or the logos alone without one.
 */
export function sheetFor(r: Pick<Race, 'office' | 'state'>): Sheet {
  const s = sprite()
  if (r.office === 'president' || r.office === 'senate' || r.office === 'house') return s
  const gov = febRaces().find(x => x.office === 'governor' && x.state === r.state)
  return (gov && s.sheets[gov.id]) || logosSheet()
}

/** A candidate's photo, approved face by face by the owner (D-065, D-071), and where it came from. */
export interface Photo {
  page: string
  page_size: number
  share: string
  share_size: number
  /** "Official X account of Bola Tinubu (@officialABAT)", "Wikimedia Commons", ... */
  source: string
  file_page: string
  author?: string
  licence?: string
  licence_url?: string
  taken?: string
  retrieved: string
  /** The day the owner approved the face on a contact sheet. */
  approved: string
  /** Senate, House and State Assembly (D-071): the card's own small copy, loaded only when its race is shown. */
  card?: string
  card_bytes?: number
}
let photos: Record<string, Photo> | null = null
export function allPhotos(): Record<string, Photo> {
  photos ??= read<{ people: Record<string, Photo> }>('photos.json').people
  return photos
}
/** The candidate's photo, or null (the neutral placeholder): only approved faces (D-065, D-071). */
export const photo = (candidateId: string): Photo | null => allPhotos()[candidateId] ?? null
/** For the share picture: the photo's larger copy (loaded only when someone shares), or '' for no photo. */
export const sharePhoto = (c: Candidate): string => { const p = photo(c.id); return p ? `/${p.share}` : '' }

/** The 16 January races. */
export const races = () => load().races
/** The 6 February races (Governor, State House of Assembly). */
export const febRaces = () => load().febRaces
export const allRaces = () => [...load().races, ...load().febRaces]
export const race = (id: string) => {
  const r = load().raceById.get(id)
  if (!r) throw new Error(`unknown race ${id}`)
  return r
}
export const source = (id: string) => {
  const s = load().sources.get(id)
  if (!s) throw new Error(`unknown source ${id}`)
  return s
}
const pdfDate = (d?: string | null) => (d && /^D:\d{8}/.test(d) ? `${d.slice(2, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}` : null)
/** The date a source's content is from: INEC's own PDF date, else when the snapshot (crawl or page) was taken. */
export const sourceContentDate = (id: string) => {
  const s = source(id)
  return pdfDate(s.pdf_modified) ?? pdfDate(s.pdf_created) ?? s.retrieved_at.slice(0, 10)
}
const latest = (dates: string[]) => [...dates].sort().at(-1)!
/** A race's content date: its INEC list, or the background research for presidential tickets, whichever is later. */
/** When a race's page last changed for a reader: its INEC sources, background research, approved photos (D-071) and the
 *  day its state's first group changed (D-070). The sitemap's lastmod. */
export const raceContentDate = (r: Race) => latest([
  ...r.sources.map(sourceContentDate),
  ...r.candidates.flatMap(c => [c.candidate.background?.researched, c.running_mate?.background?.researched, photo(c.id)?.approved]).filter((d): d is string => !!d),
  ...(groupOf(r).state ? [groupOf(r).state!.since] : []),
])
/** Geography pages show INEC's locator, and their 6 February links follow the IReV ward lists (D-030). */
export const geographyContentDate = () => latest(['inec-pu-locator', 'inec-irev-2023-assembly'].map(sourceContentDate))

export const states = () => [...load().states].sort((a, b) => a.name.localeCompare(b.name))
export const stateGeo = (code: string) => {
  const g = load().geo.get(code)
  if (!g) throw new Error(`unknown state ${code}`)
  return g
}
export const candidate = (id: string) => {
  for (const r of allRaces()) {
    const c = r.candidates.find(x => x.id === id)
    if (c) return { race: r, c }
  }
  throw new Error(`unknown candidate ${id}`)
}
export const allCandidates = () => allRaces().flatMap(r => r.candidates.map(c => ({ race: r, c })))
export const presidentialRace = () => races().find(r => r.office === 'president')!

export function wardBallotPath(state: StateGeo, ward: Ward): string {
  return ballotPath(state.name, ward.federal_constituency, ward.senatorial_district)
}

export function wardFebBallotPath(state: StateGeo, ward: Ward): string {
  return febBallotPath(state.name, ward.state_constituency)
}

export interface FebBallotSpec {
  state: StateGeo
  path: string
  stateSlug: string
  key: string // '' for a state with no State Assembly race on the list (Borno) or no assembly (FCT)
  governor: string | null
  sha: string[]
  unresolved: boolean
  /** Some ward with this ballot is placed differently by INEC's workbook and by IReV (OI-13, D-030). */
  disagree: boolean
}

/** Every distinct 6 February ballot: one per combination of State Assembly races a ward resolves to (plus Borno, FCT). */
let febMemo: FebBallotSpec[] | null = null
export function febBallots(): FebBallotSpec[] {
  if (febMemo) return febMemo
  const governorOf = new Map(febRaces().filter(r => r.office === 'governor').map(r => [r.state, r.id]))
  const out = new Map<string, FebBallotSpec>()
  for (const st of load().geo.values()) {
    for (const l of st.lgas) {
      for (const w of l.wards) {
        const p = wardFebBallotPath(st, w)
        if (out.has(p)) {
          if (w.sc_open_item === 'OI-13') out.get(p)!.disagree = true
          continue
        }
        const parts = p.split('/')
        out.set(p, {
          state: st, path: p, stateSlug: parts[2], key: parts[3] ?? '', governor: governorOf.get(st.name) ?? null,
          sha: [...w.state_constituency].sort(), unresolved: w.sc_mapping === 'unresolved', disagree: w.sc_open_item === 'OI-13',
        })
      }
    }
  }
  febMemo = [...out.values()]
  return febMemo
}

export interface BallotSpec {
  state: StateGeo
  path: string
  stateSlug: string
  key: string
  house: string[]
  senate: string[]
  unresolved: boolean
}

/** Every distinct ballot: one per combination of House and Senate races that some ward resolves to. */
let janMemo: BallotSpec[] | null = null
export function ballots(): BallotSpec[] {
  if (janMemo) return janMemo
  const out = new Map<string, BallotSpec>()
  for (const st of load().geo.values()) {
    for (const l of st.lgas) {
      for (const w of l.wards) {
        const p = wardBallotPath(st, w)
        if (out.has(p)) continue
        const [, , stateSlug, key] = p.split('/')
        out.set(p, {
          state: st, path: p, stateSlug, key, house: [...w.federal_constituency].sort(),
          senate: [...w.senatorial_district].sort(), unresolved: w.mapping === 'unresolved',
        })
      }
    }
  }
  janMemo = [...out.values()]
  return janMemo
}

/** A 16 January ballot's title (D-032): its House race(s), and its Senate race(s) where another ballot shares the House race. */
export function janBallotTitle(b: BallotSpec): string {
  const shared = ballots().filter(x => x.state.code === b.state.code && x.house.join() === b.house.join()).length > 1
  const senate = shared ? ` (${b.senate.map(id => race(id).name).join(' or ')})` : ''
  return `16 Jan ballot: ${b.house.map(id => race(id).name).join(' or ')}${senate}, ${b.state.name}`
}

/** A 6 February ballot's title (D-032). */
export function febBallotTitle(b: FebBallotSpec): string {
  return b.sha.length ? `6 Feb ballot: ${b.sha.map(id => race(id).name).join(' or ')}, ${b.state.name}` : `6 Feb ballot, ${b.state.name}`
}

/** The ward -> State Assembly figures for the explainer page, computed from the published data (D-028, D-030). */
export function shaMappingStats() {
  let one = 0, several = 0, disagree = 0, pusSeveral = 0, pusAll = 0
  for (const st of load().geo.values()) {
    for (const l of st.lgas) {
      for (const w of l.wards) {
        if (!w.state_constituency.length) continue
        pusAll += w.polling_units.length
        if (w.sc_mapping === 'exact') one++
        else {
          several++
          pusSeveral += w.polling_units.length
          if (w.sc_open_item === 'OI-13') disagree++
        }
      }
    }
  }
  const constituencies = febRaces().filter(r => r.office === 'state_assembly').length
  const statesWithList = new Set(febRaces().filter(r => r.office === 'state_assembly').map(r => r.state)).size
  return { one, several, disagree, pusSeveral, pusAll, constituencies, statesWithList }
}

export function findWard(code: string): { state: StateGeo, lga: Lga, ward: Ward } {
  const [s, l] = code.split('/')
  const st = stateGeo(s)
  const lga = st.lgas.find(x => x.code === `${s}/${l}`)
  const ward = lga?.wards.find(w => w.code === code)
  if (!lga || !ward) throw new Error(`unknown ward ${code}`)
  return { state: st, lga, ward }
}

export function findLga(code: string): { state: StateGeo, lga: Lga } {
  const st = stateGeo(code.split('/')[0])
  const lga = st.lgas.find(x => x.code === code)
  if (!lga) throw new Error(`unknown LGA ${code}`)
  return { state: st, lga }
}

/** The compact file the browser fetches after a state is chosen: codes, names and ballot paths only. */
export function stateSearchData(code: string): StateSearchData {
  const st = stateGeo(code)
  return {
    code: st.code,
    name: st.name,
    lgas: st.lgas.map(l => [
      l.code.split('/')[1],
      l.name,
      l.wards.map(w => [
        w.code.split('/')[2],
        w.name,
        wardBallotPath(st, w),
        w.polling_units.map(p => [p.code.split('/')[3], p.name] as [string, string]),
        wardFebBallotPath(st, w),
      ] as [string, string, string, [string, string][], string]),
    ] as StateSearchData['lgas'][number]),
  }
}

export interface ElectionDayData {
  elections: { id: string, date: string, races: string, source_id: string, quotes: string[] }[]
  hours: { open: string, close: string, source_id: string, quotes: string[] }
  steps: { text: string, quotes: string[] }[]
  steps_source_id: string
}
export const electionDay = () => read<ElectionDayData>('election-day.json')

export { slug }
