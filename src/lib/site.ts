/**
 * The site's one address (D-032). Canonicals, the sitemap, robots.txt, structured data, Open Graph tags, share links,
 * correction e-mails and the share cards all derive from it, so moving the site is this one change.
 * Registered for one year without auto-renew; the owner confirms the purchase before launch (D-033).
 */
import type { Race } from './data'
import { picture } from './share'

export const SITE_URL = 'https://whosonmyballot.ng'
export const SITE_HOST = new URL(SITE_URL).host
export const SITE_NAME = 'Who’s on my ballot?'
export const SITE_DESCRIPTION = 'Every candidate on your ballot in Nigeria’s 2027 elections, side by side, from INEC’s published lists.'
/** The owner's credit (D-032): footer and about page only, never in structured data. */
export const BUILT_BY = { name: 'Anthony Ugwuja', url: 'https://anthonyugwuja.dev' }
export const SITE_CARD = '/cards/site.png'
export const SITE_CARD_ALT = 'Who’s on my ballot? Every candidate in Nigeria’s 2027 elections, from INEC’s published lists.'
export const CORRECTIONS_EMAIL = 'corrections@anthonyugwuja.dev'

export const candidatePath = (id: string) => `/c/${id}/`
export const cardPath = (raceId: string) => `/cards/${raceId}.png`

/** A mailto link pre-filled with what we need to check a correction against INEC's documents (D-014). */
export function correctionHref(candidateId: string, pageUrl: string, name: string): string {
  const subject = `Correction: ${candidateId}`
  const body = [
    `Page: ${pageUrl}`,
    `Candidate: ${name || candidateId} (${candidateId})`,
    'Field to correct:',
    'What it should say:',
    'Where INEC (or another official source) says so, with a link:',
  ].join('\n')
  return `mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Share links are plain links: no third-party script loads, nothing is sent until the visitor taps one. */
export function shareLinks(text: string, url: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  }
}

/** The source line printed on a race's share card: the race's own INEC list, never a generic one (review 3). */
export function cardSourceCaption(raceSources: string[]): string {
  if (raceSources.includes('house-2026-09-12-consolidated'))
    return 'Source: INEC final list, 12 Sep 2026 (the latest INEC list for Niger’s House races).'
  if (raceSources.some(s => s.startsWith('governor-')))
    return 'Source: INEC updated final list of governorship candidates, 31 Oct 2026.'
  if (raceSources.includes('sha-2026-10-10'))
    return 'Source: INEC final list of State House of Assembly candidates (statutory notice, 31 Oct 2026).'
  return 'Source: INEC final list, updated 31 Oct 2026.'
}

/** The 6 February preview card: the governorship race (on every ballot in the state), else the one State Assembly race;
 *  never one of several possible State Assembly races (D-021). */
export function febCardRace(governor: string | null, sha: string[]): string | null {
  return governor ?? (sha.length === 1 ? sha[0] : null)
}

/** The share-card image for a ballot. With more than one possible House race (unresolved, D-021), use the
 *  presidential card, which is on every voter's ballot, rather than picking one of the possible races. */
export function ballotCardRace(house: string[], presidentialId: string): string {
  return house.length === 1 ? house[0] : presidentialId
}

/** The text alternative for a race's share card (the same wording for every race): what the card shows. */
export function cardAlt(r: Race): string {
  const p = picture(r)
  const parties = p.tiles.map(([party]) => party)
  const list = parties.length > 1 ? `${parties.slice(0, -1).join(', ')} and ${parties.at(-1)}` : parties[0]
  return `${p.title}: candidates of ${list}${p.more ? `, and ${p.more} more` : ''}`
}

/** The example delimitation code, in the dash format the voter's card prints. */
export const CODE_EXAMPLE = '24-15-03-012'
