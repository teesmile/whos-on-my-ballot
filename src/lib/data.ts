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
  ballot_position: number
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
/** A ballot page that contains this race, for "see the full ballot" links: the first one in path order. */
export function aBallotFor(raceId: string): { path: string } {
  if (raceId.startsWith('feb-2027-')) {
    return febBallots().filter(b => b.sha.includes(raceId) || b.governor === raceId).sort((a, b) => a.path.localeCompare(b.path))[0]
  }
  return ballots().filter(b => b.house.includes(raceId) || b.senate.includes(raceId) || raceId.includes('-president'))
    .sort((a, b) => a.path.localeCompare(b.path))[0]
}
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
