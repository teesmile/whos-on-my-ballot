import type { Candidate as C, Person, PrintingNote, Source } from '@/lib/data'

import { SourceLine } from './SourceLine'

export const NOT_PROVIDED = 'Not provided in INEC’s list'
export const PRINTING_NOTE = 'As printed in INEC’s list; this appears to be an error.'

function noteFor(notes: PrintingNote[], person: PrintingNote['person'], field: string) {
  return notes.find(n => n.person === person && n.field === field)
}

function Value({ text, note }: { text: string, note?: PrintingNote }) {
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
function PersonFields({ p, who, notes }: { p: Person, who: PrintingNote['person'], notes: PrintingNote[] }) {
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

export function Candidate({ c, src, ticket, level }: { c: C, src: Source, ticket: boolean, level: 3 | 4 }) {
  const Name = level === 3 ? 'h3' : 'h4'
  const Mate = level === 3 ? 'h4' : 'h5'
  const remarkNote = c.printing_notes.find(n => n.field === 'remarks')
  return (
    <li className="candidate" data-candidate-id={c.id} data-party={c.party}>
      <p className="party">
        <span className="acronym">{c.party}</span>
        {' '}
        <span className="party-name">{c.party_name ?? NOT_PROVIDED}</span>
      </p>
      <Name className="name">{c.candidate.name || NOT_PROVIDED}</Name>
      {ticket && <p className="position">{c.candidate.position}</p>}
      <PersonFields p={c.candidate} who="candidate" notes={c.printing_notes} />
      <dl className="fields">
        <dt>Remarks</dt>
        <dd>
          {c.remarks ? <Value text={c.remarks} note={remarkNote} /> : 'No remark in INEC’s list'}
        </dd>
      </dl>
      {ticket && c.running_mate && (
        <div className="running-mate">
          <Mate className="mate-name">
            Running mate:
            {' '}
            {c.running_mate.name || NOT_PROVIDED}
          </Mate>
          <p className="position">{c.running_mate.position}</p>
          <PersonFields p={c.running_mate} who="running_mate" notes={c.printing_notes} />
        </div>
      )}
      <SourceLine
        id={c.provenance.source_id}
        what={`Source, page ${c.provenance.page}, row ${c.provenance.sn}`}
        href={`${src.file_url}#page=${c.provenance.page}`}
      />
    </li>
  )
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
}
