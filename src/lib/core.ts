/**
 * Pure lookup logic shared by the build (server pages) and the browser module. No I/O, no network.
 * Nothing here ever sends what a visitor types anywhere: callers fetch only fixed per-state files.
 */

/** Compact per-state search data served at /data/pu/<SS>.json. Arrays keep the file small. */
export interface StateSearchData {
  code: string
  name: string
  /** [lgaCode, lgaName, wards] */
  lgas: [string, string, [string, string, string, [string, string][], string][]][]
  // ward: [wardCode, wardName, ballotPath (16 Jan), [[puCode, puName]], febBallotPath (6 Feb)]
}

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Between the parts: the card's dashes (or a phone's typographic dash), slashes, spaces, dots or commas, in any mix.
const DELIM = /^\s*(\d{1,2})[\s/.,\-\u2010-\u2015\u2212]+(\d{1,2})[\s/.,\-\u2010-\u2015\u2212]+(\d{1,2})[\s/.,\-\u2010-\u2015\u2212]+(\d{1,3})\s*$/
// No separators at all: exactly nine digits, two each for state, LGA and ward, three for the polling unit.
const BARE = /^\s*(\d{2})(\d{2})(\d{2})(\d{3})\s*$/

/**
 * Normalise a PVC delimitation code to "SS/LL/WW/PPP", or null. Mirrors pipeline geo.parse_delimitation_code.
 * It only normalises: whether the polling unit exists is checked against INEC's list, never guessed.
 */
export function parseDelimitationCode(text: string): string | null {
  const m = DELIM.exec(text ?? '') ?? BARE.exec(text ?? '')
  if (!m) return null
  const [s, l, w, p] = m.slice(1).map(Number)
  if (s < 1 || s > 37 || l < 1 || w < 1 || p < 1) return null
  return `${pad(s, 2)}/${pad(l, 2)}/${pad(w, 2)}/${pad(p, 3)}`
}

/** A code as the voter's card prints it, with dashes ("24-15-03-012"), for display. Data keeps "SS/LL/WW/PPP". */
export function cardCode(code: string): string {
  return code.replaceAll('/', '-')
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

/** "/ballot/<state>/<house>[-or-<house>]--<senate>[-or-<senate>]/" from race ids. */
export function ballotPath(stateName: string, houseRaceIds: string[], senateRaceIds: string[]): string {
  const st = slug(stateName)
  const strip = (prefix: string) => (id: string) => {
    if (!id.startsWith(prefix)) throw new Error(`race ${id} is not in ${stateName}`)
    return id.slice(prefix.length)
  }
  const house = [...houseRaceIds].sort().map(strip(`jan-2027-house-${st}-`))
  const senate = [...senateRaceIds].sort().map(strip(`jan-2027-senate-${st}-`))
  if (!house.length || !senate.length) throw new Error('a ballot needs at least one House and one Senate race')
  return `/ballot/${st}/${house.join('-or-')}--${senate.join('-or-')}/`
}

/** "/ballot-feb/<state>/<sha>[-or-<sha>]/", or "/ballot-feb/<state>/" where no State Assembly race applies (Borno, FCT). */
export function febBallotPath(stateName: string, shaRaceIds: string[]): string {
  const st = slug(stateName)
  const prefix = `feb-2027-sha-${st}-`
  const keys = [...shaRaceIds].sort().map((id) => {
    if (!id.startsWith(prefix)) throw new Error(`race ${id} is not in ${stateName}`)
    return id.slice(prefix.length)
  })
  return keys.length ? `/ballot-feb/${st}/${keys.join('-or-')}/` : `/ballot-feb/${st}/`
}

/** Hash used to name the confirmed polling unit on a ballot page. The fragment never leaves the browser. */
export function puHash(code: string): string {
  return `#pu-${code.replaceAll('/', '-')}`
}

/**
 * A ballot page's address fragment holds up to two things: the polling unit chosen (#pu-SS-LL-WW-PPP, kept in the
 * browser) and the race tab open (#senate). Together: #pu-24-15-03-012&senate. Fragments are never sent to a server.
 */
export function codeFromHash(hash: string): string | null {
  const m = /^#pu-(\d{2})-(\d{2})-(\d{2})-(\d{3})(?:&[\w-]+)?$/.exec(hash)
  return m ? `${m[1]}/${m[2]}/${m[3]}/${m[4]}` : null
}

/** The tab (or element id) named in a ballot page's fragment, if any. */
export function tabFromHash(hash: string): string | null {
  const m = /^#(?:pu-\d{2}-\d{2}-\d{2}-\d{3})?&?([\w-]+)?$/.exec(hash)
  const t = m?.[1]
  return t && !t.startsWith('pu-') ? t : null
}

/** The fragment for a polling unit (if one was chosen) plus a tab. */
export function hashWithTab(hash: string, tab: string): string {
  const pu = /^#(pu-\d{2}-\d{2}-\d{2}-\d{3})/.exec(hash)?.[1]
  return pu ? `#${pu}&${tab}` : `#${tab}`
}

export interface FoundPollingUnit {
  code: string
  name: string
  ward: string
  lga: string
  state: string
  ballotPath: string
  febBallotPath: string
}

export function findByCode(data: StateSearchData, code: string): FoundPollingUnit | null {
  const [s, l, w, p] = code.split('/')
  if (s !== data.code) return null
  for (const [lc, ln, wards] of data.lgas) {
    if (lc !== l) continue
    for (const [wc, wn, path, pus, febPath] of wards) {
      if (wc !== w) continue
      for (const [pc, pn] of pus) {
        if (pc === p) return { code, name: pn, ward: wn, lga: ln, state: data.name, ballotPath: path, febBallotPath: febPath }
      }
    }
  }
  return null
}

// ---------------------------------------------------------------- search

function normalise(text: string): string[] {
  return text.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
}

/** Levenshtein distance, early exit above `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** INEC abbreviates ("PRY SCH", "GOVT", "SEC"): its word's letters appear, in order, in what was typed. */
function abbreviates(w: string, q: string): boolean {
  if (w.length < 2 || w.length >= q.length || w[0] !== q[0]) return false
  let i = 0
  for (const ch of q) if (ch === w[i]) i++
  return i === w.length
}

function tokenScore(q: string, words: string[]): number {
  let best = 0
  for (const w of words) {
    if (w === q) return 1
    if (w.startsWith(q)) best = Math.max(best, 0.9)
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 0.8)
    else if (abbreviates(w, q)) best = Math.max(best, 0.7)
    else if (q.length >= 4) {
      const max = q.length >= 8 ? 2 : 1
      const d = distance(q, w, max)
      if (d <= max) best = Math.max(best, 0.75 - 0.1 * d)
    }
  }
  return best
}

export interface SearchHit extends FoundPollingUnit {
  score: number
}

/**
 * Closest polling units in one LGA to a name or landmark. Every query word must match something (exactly, as a
 * prefix, inside a word, as an INEC abbreviation, or within one or two typos). Ranking, highest first:
 *   1. the polling unit's whole name equals the query;
 *   2. matches found in the polling unit's own name;
 *   3. matches that need the ward name, worth half, since every unit in a ward shares it.
 */
export function searchLga(data: StateSearchData, lgaCode: string, query: string, limit = 5): SearchHit[] {
  const q = normalise(query)
  if (!q.length) return []
  const exact = q.join(' ')
  const hits: SearchHit[] = []
  for (const [lc, ln, wards] of data.lgas) {
    if (lc !== lgaCode) continue
    for (const [wc, wn, path, pus, febPath] of wards) {
      const wardWords = normalise(wn)
      for (const [pc, pn] of pus) {
        const words = normalise(pn)
        let total = 0
        let matchedAll = true
        for (const t of q) {
          const own = tokenScore(t, words)
          const viaWard = tokenScore(t, wardWords) * 0.5
          const s = Math.max(own, viaWard)
          if (s === 0) {
            matchedAll = false
            break
          }
          total += s
        }
        if (!matchedAll) continue
        const score = (words.join(' ') === exact ? 2 : 0) + total / q.length
        hits.push({ code: `${data.code}/${lc}/${wc}/${pc}`, name: pn, ward: wn, lga: ln, state: data.name, ballotPath: path, febBallotPath: febPath, score })
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)).slice(0, limit)
}
