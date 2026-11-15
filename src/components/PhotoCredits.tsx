import { formatDate } from '@/components/Candidate'
import { slug } from '@/lib/core'
import { allPhotos, candidate, type Photo } from '@/lib/data'
import { OFFICE_TITLE } from '@/lib/share'

/**
 * Photo credits (D-068, D-094): one page per state (and one for the presidential candidates), listed from an index page linked
 * from About, so no page outgrows its budget as photos are added. Each credit names the candidate, the race, the source with its
 * link, the author and licence where there is one, and the retrieval date.
 */
export type CreditGroup = { key: string, name: string, ids: string[] }

/** The groups: "President", then every state in alphabetical order, each with the IDs of its candidates who have a photo. */
export function creditGroups(): CreditGroup[] {
  const groups = new Map<string, CreditGroup>()
  for (const id of Object.keys(allPhotos()).sort()) {
    const { race: r } = candidate(id)
    const name = r.office === 'president' ? 'President' : (r.state ?? '')
    const key = r.office === 'president' ? 'president' : slug(name)
    if (!groups.has(key)) groups.set(key, { key, name, ids: [] })
    groups.get(key)!.ids.push(id)
  }
  return [...groups.values()].sort((a, b) => (a.key === 'president' ? -1 : b.key === 'president' ? 1 : a.name.localeCompare(b.name)))
}

/** "APC, President" or "APC, Governor, KANO": whose photo a credit is for. */
function creditRace(id: string): string {
  const { race: r, c } = candidate(id)
  return r.office === 'president' ? `${c.party}, President` : `${c.party}, ${OFFICE_TITLE[r.office]}, ${r.state}`
}

/** The latest date a photo in the group was approved or checked: the page's content date. */
export const groupDate = (g: CreditGroup) => g.ids.map(id => allPhotos()[id].approved).sort().at(-1)!

export function CreditList({ ids }: { ids: string[] }) {
  const photos: [string, Photo][] = ids.map(id => [id, allPhotos()[id]])
  return (
    <ul className="photo-credits">
      {photos.map(([id, p]) => (
        <li key={id} id={`credit-${id}`}>
          <strong>{candidate(id).c.candidate.name}</strong>
          {` (${creditRace(id)}): `}
          <a href={p.file_page}>{p.source}</a>
          {p.author && `, by ${p.author}`}
          {p.licence && p.licence_url && (
            <>
              {', licensed under '}
              <a href={p.licence_url}>{p.licence}</a>
            </>
          )}
          {`; cropped to a square for this site. Retrieved ${formatDate(p.retrieved)}.`}
        </li>
      ))}
    </ul>
  )
}
