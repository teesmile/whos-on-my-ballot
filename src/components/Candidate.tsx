import type { Candidate as C, Person, PrintingNote } from '@/lib/data'
import { photo, photoSlot, sprite } from '@/lib/data'
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
function SpriteCell({ index, size, label, className }: { index: number, size: number, label: string | null, className: string }) {
  const s = sprite()
  const a11y = label ? { 'role': 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg className={className} width={size} height={size} viewBox={`${index * s.cell + 1} 1 ${s.cell - 2} ${s.cell - 2}`} focusable="false" {...a11y}>
      <image href={`/${s.file}`} width={s.width} height={s.height} />
    </svg>
  )
}

/** A party's logo from INEC's register (D-043): the same size and treatment for every party, the acronym as its text. */
export function PartyLogo({ party, size }: { party: string, size: number }) {
  const i = sprite().logos[party]
  if (i === undefined) throw new Error(`no INEC logo for ${party} in the sprite`)
  return <SpriteCell index={i} size={size} label={party} className="logo" />
}

/** The same plain placeholder for every first-group presidential candidate with no properly licensed photo (D-059). */
export function PhotoPlaceholder({ size, label = null }: { size: number, label?: string | null }) {
  const a11y = label ? { 'role': 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg className="photo photo-none" width={size} height={size} viewBox="0 0 48 48" focusable="false" {...a11y}>
      <rect width="48" height="48" fill="#eeeeee" />
      <circle cx="24" cy="19" r="8" fill="#c4c4c4" />
      <path d="M9 44c1.5-9 7.5-14 15-14s13.5 5 15 14z" fill="#c4c4c4" />
    </svg>
  )
}

/** A candidate's photo slot (D-059): the photo from the sprite, the placeholder, or nothing. Beside the name, so hidden from screen readers. */
export function CardPhoto({ c, size }: { c: C, size: number }) {
  const slot = photoSlot(c)
  if (!slot) return null
  // The placeholder is a cell of the same sprite, so every first-group card has exactly the same markup (D-059).
  const i = slot === 'photo' ? sprite().photos[c.id] : sprite().placeholder
  if (i === undefined) throw new Error(`no sprite cell for ${c.id}'s photo`)
  return <SpriteCell index={i} size={size} label={null} className="photo" />
}

/**
 * One compact card per ticket, the same for every party (the working rules §1): logo, acronym, the name as INEC prints it
 * and, on a ticket, the running mate. The whole card opens the candidate's page, where every field and its citation is.
 * The first group's presidential candidates also show their photo or the placeholder (D-059); every card stays the same size.
 */
export function CandidateCard({ c, mateLabel }: { c: C, mateLabel: string | null }) {
  const named = Boolean(c.candidate.name)
  const words = [c.party, c.party_name ?? '', c.candidate.name, c.running_mate?.name ?? ''].join(' ').toLowerCase()
  return (
    <li className={named ? 'card' : 'card muted'} data-candidate-id={c.id} data-party={c.party} data-group={c.display_group} data-words={words}>
      <a href={candidatePath(c.id)}>
        <span className="card-pics">
          <PartyLogo party={c.party} size={48} />
          <CardPhoto c={c} size={48} />
        </span>
        <span className="card-party" aria-hidden="true">{c.party}</span>
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
