/**
 * Search titles and descriptions for race and candidate pages (owner, 25 Nov 2026, D-100): the words people search with
 * ("governorship candidates 2027", "federal constituency", "full list"), the same pattern for every race and candidate.
 *
 * Candidate names stay exactly as INEC prints them (hard rule 1). State names, and constituency and district names
 * that INEC prints in capitals, are shown in title case here; the data keeps INEC's text.
 */
import { allCandidates, allRaces, type Candidate, type Race } from './data'
import { placeCase, placeName } from './names'
import { ELECTION_DAY, namedCount } from './share'

export { placeCase }

/** Not provided in INEC's list: the same words as the candidate card. */
const NOT_PROVIDED = 'Not provided in INEC\'s list'
/** Titles stay under this length where they can (owner: "under about 65 characters where possible"). */
export const TITLE_MAX = 65

/** 'AKWA IBOM' -> 'Akwa Ibom'; 'FCT' stays 'FCT'. */
export const stateCase = (s: string | null) => placeCase(s ?? '')
/** In running text: 'Abia State', 'the FCT'. */
const stateWords = (s: string | null) => (s === 'FCT' ? 'the FCT' : `${stateCase(s)} State`)
const area = (r: Race) => placeName(r.name)

/** A race's title in the owner's patterns, longest first: the shorter form drops the " - {State}" ending. */
function raceForms(r: Race): string[] {
  const st = stateCase(r.state)
  switch (r.office) {
    case 'president': return ['2027 presidential candidates in Nigeria - full list']
    case 'governor': return [`${st} governorship candidates 2027 - full list`]
    case 'senate': return [`${area(r)} senatorial district candidates 2027 - ${st}`, `${area(r)} senatorial district candidates 2027`]
    case 'house': return [`${area(r)} federal constituency candidates 2027 - ${st}`, `${area(r)} federal constituency candidates 2027`]
    case 'state_assembly': return [`${area(r)} state constituency candidates 2027 - ${st} Assembly`, `${area(r)} state constituency candidates 2027`]
  }
}

/** Picks, for each item, the first of its forms that fits TITLE_MAX, else its shortest form, never a form another item
 *  also uses (when every form is shared, the first). */
function pick<T>(items: T[], forms: (x: T) => string[]): Map<T, string> {
  const count = new Map<string, number>()
  for (const x of items) for (const f of new Set(forms(x))) count.set(f, (count.get(f) ?? 0) + 1)
  const out = new Map<T, string>()
  for (const x of items) {
    const fs = forms(x).filter(f => count.get(f) === 1)
    const usable = fs.length ? fs : forms(x).slice(0, 1)
    out.set(x, usable.find(f => f.length <= TITLE_MAX) ?? usable.reduce((a, b) => (b.length < a.length ? b : a)))
  }
  return out
}

let raceTitles: Map<string, string> | null = null
export function raceMetaTitle(r: Race): string {
  if (!raceTitles) {
    const races = allRaces()
    const picked = pick(races, raceForms)
    raceTitles = new Map(races.map(x => [x.id, picked.get(x)!]))
  }
  return raceTitles.get(r.id)!
}

/** "for Governor of Abia State", "for the Senate in Abia Central, Abia State", ... */
function officeIn(r: Race): string {
  switch (r.office) {
    case 'president': return 'for President of Nigeria'
    case 'governor': return `for Governor of ${stateWords(r.state)}`
    case 'senate': return `for the Senate in ${area(r)}, ${stateWords(r.state)}`
    case 'house': return `for the House of Representatives in ${area(r)}, ${stateWords(r.state)}`
    case 'state_assembly': return `for the ${r.state === 'FCT' ? 'FCT' : stateCase(r.state)} State House of Assembly in ${area(r)}, ${stateWords(r.state)}`
  }
}

/** After "in {area}, {State}" a comma, as the owner's pattern has it; none after President or Governor. */
const placed = (r: Race) => (r.office === 'president' || r.office === 'governor' ? '' : ',')

export function raceMetaDescription(r: Race): string {
  const n = namedCount(r)
  const who = n === 1 ? 'The only candidate' : n === 0 ? 'No named candidate' : `All ${n} candidates`
  return `${who} ${officeIn(r)}${placed(r)} on ${ELECTION_DAY[r.election]}, as listed by INEC, with their parties and photos where available.`
}

/** "Abia Central senatorial", "Abia governorship", ... as in "{area} {office} candidate 2027". */
function officeShort(r: Race): string {
  switch (r.office) {
    case 'president': return 'Nigeria presidential'
    case 'governor': return `${stateCase(r.state)} governorship`
    case 'senate': return `${area(r)} senatorial`
    case 'house': return `${area(r)} House of Reps`
    case 'state_assembly': return `${area(r)} State Assembly`
  }
}

const nameOf = (c: Candidate) => c.candidate.name || NOT_PROVIDED
function candidateForms({ race, c }: { race: Race, c: Candidate }): string[] {
  const base = `${nameOf(c)} (${c.party}) - ${officeShort(race)} candidate 2027`
  const st = race.office === 'president' || race.office === 'governor' ? '' : `, ${stateCase(race.state)}`
  return st ? [base, `${base}${st}`] : [base]
}

let candidateTitles: Map<string, string> | null = null
export function candidateMetaTitle(race: Race, c: Candidate): string {
  if (!candidateTitles) {
    const all = allCandidates()
    // The short form first: the state is added only where two pages would otherwise share a title.
    const picked = pick(all, x => candidateForms(x))
    candidateTitles = new Map(all.map(x => [x.c.id, picked.get(x)!]))
  }
  return candidateTitles.get(c.id)!
}

export function candidateMetaDescription(race: Race, c: Candidate): string {
  const when = `in the ${ELECTION_DAY[race.election]} election`
  const party = c.party_name ?? c.party
  return c.candidate.name
    ? `${c.candidate.name} is the ${party} candidate ${officeIn(race)}${placed(race)} ${when}, as listed by INEC. See everyone else on the same ballot.`
    : `INEC's list names no candidate for the ${party} ${officeIn(race)}${placed(race)} ${when}. See everyone else on the same ballot.`
}
