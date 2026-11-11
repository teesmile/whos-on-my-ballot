import type { Metadata } from 'next'

import { BackgroundMethod, Ref, Refs, SourceList, Timeline, timelineItems } from '@/components/Background'
import { NOT_PROVIDED, noteFor, PartyLogo, PersonFields, Value } from '@/components/Candidate'
import { mateLabel, raceTitle, TICKET_OFFICES } from '@/components/RaceSection'
import { Share } from '@/components/Share'
import { aBallotFor, allCandidates, type Candidate as CandidateT, candidate, type Person as PersonT, photo, presidentialRace, sharePhoto, source } from '@/lib/data'
import { pageGraph, pageMeta } from '@/lib/seo'
import { ELECTION_DAY, noCandidateText, picture } from '@/lib/share'
import { candidatePath, cardAlt, cardPath, correctionHref, SITE_URL } from '@/lib/site'
import { JsonLd } from '@/components/JsonLd'

/** The same title pattern for every candidate (the working rules §1; D-032): name as INEC printed it, party, office. */
const OFFICE_SHORT = { president: 'President', senate: 'Senate', house: 'House of Reps', governor: 'Governor', state_assembly: 'State Assembly' } as const
const baseTitle = (race: { office: keyof typeof OFFICE_SHORT }, c: { party: string, candidate: { name: string } }) =>
  `${c.candidate.name || NOT_PROVIDED} (${c.party}), ${OFFICE_SHORT[race.office]}`
let shared: Set<string> | null = null
/** When two candidates' pages would share a title (same name, party and office), both add their constituency: one rule for all. */
function candidateTitle(race: { office: keyof typeof OFFICE_SHORT, name: string }, c: { party: string, candidate: { name: string } }) {
  if (!shared) {
    const counts = new Map<string, number>()
    for (const x of allCandidates()) counts.set(baseTitle(x.race, x.c), (counts.get(baseTitle(x.race, x.c)) ?? 0) + 1)
    shared = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k))
  }
  const base = baseTitle(race, c)
  return shared.has(base) ? `${base}: ${race.name}` : base
}

export const dynamicParams = false
export function generateStaticParams() {
  return allCandidates().map(({ c }) => ({ id: c.id }))
}

const of = async (params: Promise<{ id: string }>) => candidate((await params).id)

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { race, c } = await of(params)
  return pageMeta({
    title: candidateTitle(race, c), path: candidatePath(c.id),
    description: `${c.candidate.name || NOT_PROVIDED} (${c.party}): ${raceTitle(race)}, ${race.election === 'feb-2027' ? '6 February' : '16 January'} 2027, as listed by INEC.`,
    image: { url: cardPath(race.id), alt: cardAlt(race) },
  })
}

/** Presidential background is all or none (D-013): shown only when every named person has a researched record. */
function presidentialBackgroundReady(): boolean {
  const people = presidentialRace().candidates.flatMap(c => [c.candidate, c.running_mate]).filter(p => p && p.name)
  return people.length > 0 && people.every(p => p!.background)
}

/** An INEC source in the page's numbered list. */
function inecRef(refs: Refs, id: string, detail: string, href?: string): number {
  const s = source(id)
  return refs.add({ key: `${id}:${detail}`, href: href ?? s.page_url ?? s.archive_url ?? s.file_url, publisher: 'INEC', detail: `${s.title.replace(/^INEC: /, '')}${detail}`, published: null, retrieved: s.retrieved_at, sourceId: id })
}

function Person({ p, who, c, heading, refN, children }: { p: PersonT, who: 'candidate' | 'running_mate', c: CandidateT, heading: React.ReactNode, refN: number, children?: React.ReactNode }) {
  return (
    <div className="person">
      {heading}
      {p.position && <p className="position">{`INEC lists: ${p.position}`}</p>}
      <PersonFields p={p} who={who} notes={c.printing_notes} />
      {children}
      <p className="from-ref">
        From INEC’s list
        <Ref n={refN} />
      </p>
    </div>
  )
}

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { race, c } = await of(params)
  const ticket = TICKET_OFFICES.includes(race.office)
  const ballot = aBallotFor(race.id)
  const url = `${SITE_URL}${candidatePath(c.id)}`
  const name = c.candidate.name || noCandidateText(c)
  const showBackground = race.office === 'president' && presidentialBackgroundReady()
  const inec = source(c.provenance.source_id)
  const pic = photo(c.id)
  const refs = new Refs()
  const listN = inecRef(refs, c.provenance.source_id, `, page ${c.provenance.page}, row ${c.provenance.sn}`, `${inec.file_url}#page=${c.provenance.page}`)
  const partyN = inecRef(refs, 'inec-parties', ' (full party name and logo)')
  const photoN = pic ? refs.add({ key: pic.file_page, href: pic.file_page, publisher: `Photo: ${pic.credit}`, detail: `${pic.licence}, via Wikimedia Commons`, published: null, retrieved: pic.retrieved }) : 0
  const people = ([['Candidate', c.candidate], [mateLabel(race), c.running_mate]] as const).filter(([, p]) => p)
  const raceLine = `${raceTitle(race)} - ${ELECTION_DAY[race.election]}`
  // Numbered in the order they appear: careers, then party histories.
  const career = showBackground ? people.map(([, p]) => (p?.name ? timelineItems(p.background?.public_offices ?? [], refs) : null)) : []
  const history = showBackground ? people.map(([, p]) => (p?.name ? timelineItems(p.background?.party_history ?? [], refs) : null)) : []
  return (
    <>
      <JsonLd data={pageGraph(candidatePath(c.id), candidateTitle(race, c), [['Home', '/'], [raceTitle(race), `${ballot.path}`], [name, candidatePath(c.id)]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        <span aria-hidden="true"> / </span>
        <a href={`${ballot.path}#race-${race.id}`}>{raceTitle(race)}</a>
      </nav>

      <header className={pic ? 'profile has-photo' : 'profile'}>
        {pic && (
          <figure className="profile-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export: a pre-sized WebP from the pipeline */}
            <img src={`/${pic.page}`} width={pic.page_size / 2} height={pic.page_size / 2} alt={`Photo of ${c.candidate.name}`} />
            <figcaption>
              {`Photo: ${pic.credit}, ${pic.licence}`}
              <Ref n={photoN} />
            </figcaption>
          </figure>
        )}
        <div className="profile-text">
          <h1 data-candidate-id={c.id}>{name}</h1>
          <div className="party-head">
            <PartyLogo party={c.party} size={56} />
            <p className="party">
              <span className="acronym" aria-hidden="true">{c.party}</span>
              {' '}
              <span className="party-name">{c.party_name ?? NOT_PROVIDED}</span>
              <Ref n={partyN} />
            </p>
          </div>
          <p className="profile-race">{raceLine}</p>
          {ticket && c.running_mate && (
            <p className="profile-mate">
              {`${mateLabel(race)}: `}
              <strong>{c.running_mate.name || NOT_PROVIDED}</strong>
            </p>
          )}
          <p className="profile-actions">
            <a className="btn btn-secondary" href={`${ballot.path}#race-${race.id}`}>Everyone in this race</a>
          </p>
        </div>
      </header>

      <section aria-labelledby="inec" className="panel">
        <h2 id="inec">From INEC’s list</h2>
        <Person p={c.candidate} who="candidate" c={c} refN={listN} heading={ticket ? <h3>{`Candidate: ${name}`}</h3> : null}>
          <dl className="fields">
            <dt>Remarks</dt>
            <dd>{c.remarks ? <Value text={c.remarks} note={noteFor(c.printing_notes, 'running_mate', 'remarks') ?? noteFor(c.printing_notes, 'candidate', 'remarks')} /> : 'No remark in INEC’s list'}</dd>
          </dl>
        </Person>
        {ticket && c.running_mate && (
          <Person p={c.running_mate} who="running_mate" c={c} refN={listN} heading={<h3 id="mate">{`${mateLabel(race)}: ${c.running_mate.name || NOT_PROVIDED}`}</h3>} />
        )}
      </section>

      {showBackground && (
        <>
          <section aria-labelledby="career" className="panel" data-background>
            <h2 id="career">Career and offices held</h2>
            {people.map(([role, p], i) => (
              <div key={role} className="person">
                <h3>{`${role}: ${p?.name || NOT_PROVIDED}`}</h3>
                {career[i] ? <Timeline items={career[i]} /> : <p className="timeline-none">INEC’s list names no candidate for this party.</p>}
              </div>
            ))}
          </section>
          <section aria-labelledby="party-history" className="panel">
            <h2 id="party-history">Party history</h2>
            {people.map(([role, p], i) => (
              <div key={role} className="person">
                <h3>{`${role}: ${p?.name || NOT_PROVIDED}`}</h3>
                {history[i] ? <Timeline items={history[i]} /> : <p className="timeline-none">INEC’s list names no candidate for this party.</p>}
              </div>
            ))}
            {c.candidate.background && <BackgroundMethod researched={c.candidate.background.researched} />}
          </section>
        </>
      )}

      <Share label="Share" url={url} picture={picture(race, sharePhoto)} />

      <section aria-labelledby="correct" className="correct">
        <h2 id="correct">Report a correction</h2>
        <p>
          If something here doesn’t match INEC’s documents, tell us what and where INEC says so. We check every report against INEC’s own documents.
        </p>
        <p className="correct-row">
          <a className="btn" href={correctionHref(c.id, url, c.candidate.name)}>Report a correction</a>
        </p>
        <ul className="link-list">
          <li><a href="/corrections/">Corrections made so far</a></li>
        </ul>
      </section>

      <SourceList refs={refs} />
    </>
  )
}
