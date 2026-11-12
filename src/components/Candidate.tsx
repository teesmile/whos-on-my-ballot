import type { Candidate as C, Person, PrintingNote } from '@/lib/data'
import { photo, sprite } from '@/lib/data'
import { noCandidateText } from '@/lib/share'
import { candidatePath } from '@/lib/site'


export const NOT_PROVIDED = 'Not provided in INEC’s list'
export const PRINTING_NOTE = 'As printed in INEC’s list; this appears to be an error.'

export function noteFor(notes: PrintingNote[], person: PrintingNote['person'], field: string) {
  return notes.find(n => n.person === person && n.field === field)
}

export function Value({ text, note }: { text: string, note?: PrintingNote }) {
  if (!text) return <>{NOT_PROVIDED}</>
  return (
    <>
      {text}
      {note && <span className="printing-note"> ({PRINTING_NOTE})</span>}
    </>
  )
}

function age(p: Person): string {
  if (p.age !== null) return String(p.age)
  return p.age_as_printed
}

function gender(g: Person['gender']): string {
  return g === 'M' ? 'Male' : g === 'F' ? 'Female' : ''
}

/** The same fields, in the same order, for every person on every ballot (the working rules §1). */
export function PersonFields({ p, who, notes }: { p: Person, who: PrintingNote['person'], notes: PrintingNote[] }) {
  return (
    <dl className="fields">
      <dt>Age</dt>
      <dd><Value text={age(p)} note={noteFor(notes, who, 'age')} /></dd>
      <dt>Gender</dt>
      <dd><Value text={gender(p.gender)} /></dd>
      <dt>Disability (PWD)</dt>
      <dd><Value text={p.pwd} /></dd>
      <dt>Qualifications</dt>
      <dd><Value text={p.qualifications} note={noteFor(notes, who, 'qualifications')} /></dd>
    </dl>
  )
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
}

/**
 * One square cell of the sprite (every logo and approved photo in one image, so a page makes one image request).
 * The 1-pixel inset keeps neighbouring cells from bleeding in when the browser scales the image.
 */
function SpriteCell({ x, y, cell, size, label, className, logosOnly = false }: { x: number, y: number, cell: number, size: number, label: string | null, className: string, logosOnly?: boolean }) {
  const s = sprite()
  const a11y = label ? { 'role': 'img', 'aria-label': label } : { 'aria-hidden': true }
  const img = logosOnly ? { href: `/${s.logo_file}`, width: s.logo_width, height: s.cell } : { href: `/${s.file}`, width: s.width, height: s.height }
  return (
    <svg className={className} width={size} height={size} viewBox={`${x + 1} ${y + 1} ${cell - 2} ${cell - 2}`} focusable="false" {...a11y}>
      <image {...img} />
    </svg>
  )
}

/**
 * A party's logo from INEC's register (D-043): the same size and treatment for every party, the acronym as its text.
 * `logosOnly` draws it from the logos-only sprite, for a page that shows no photo card (a candidate page).
 */
export function PartyLogo({ party, size, logosOnly = false }: { party: string, size: number, logosOnly?: boolean }) {
  const s = sprite()
  const i = s.logos[party]
  if (i === undefined) throw new Error(`no INEC logo for ${party} in the sprite`)
  return <SpriteCell x={i * s.cell} y={0} cell={s.cell} size={size} label={party} className="logo" logosOnly={logosOnly} />
}

/**
 * The candidate's photo from the sprite (only presidential candidates, only faces the owner approved: D-065), or the same
 * plain placeholder for everyone else, in the same place and size. Beside the name it repeats, so screen readers skip it.
 */
export function CardPhoto({ c, size }: { c: C, size: number }) {
  // sized by the stylesheet (the CSP allows no inline styles), the same as a photo of `size` pixels
  if (!photo(c.id)) return <span className="photo ph" aria-hidden="true" />
  const s = sprite()
  const i = s.photos[c.id]
  if (i === undefined) throw new Error(`no sprite cell for ${c.id}'s photo`)
  return <SpriteCell x={i * s.photo_cell} y={s.photo_y} cell={s.photo_cell} size={size} label={null} className="photo" />
}

/**
 * One compact card per ticket, the same for every party (the working rules §1): logo, acronym, the name as INEC prints it
 * and, on a ticket, the running mate. The photo, or the same placeholder for everyone without one, fills the card's top
 * right corner. The whole card opens the candidate's page, where every field and its citation is.
 */
export function CandidateCard({ c, mateLabel }: { c: C, mateLabel: string | null }) {
  const named = Boolean(c.candidate.name)
  const words = [c.party, c.party_name ?? '', c.candidate.name, c.running_mate?.name ?? ''].join(' ').toLowerCase()
  return (
    <li className={named ? 'card' : 'card muted'} data-candidate-id={c.id} data-party={c.party} data-group={c.display_group} data-words={words}>
      <a href={candidatePath(c.id)}>
        <span className="card-top">
          <span className="card-id">
            <PartyLogo party={c.party} size={48} />
            <span className="card-party" aria-hidden="true">{c.party}</span>
          </span>
          <CardPhoto c={c} size={76} />
        </span>
        <span className="card-name">{named ? c.candidate.name : noCandidateText(c)}</span>
        {mateLabel && c.running_mate?.name && (
          <span className="card-mate">
            {`${mateLabel}: `}
            {c.running_mate.name}
          </span>
        )}
      </a>
    </li>
  )
}
