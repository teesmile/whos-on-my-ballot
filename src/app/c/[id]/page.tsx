import type { Metadata } from 'next'

import { Background } from '@/components/Background'
import { NOT_PROVIDED, noteFor, PartyLogo, PersonFields, Value } from '@/components/Candidate'
import { mateLabel, raceTitle, TICKET_OFFICES } from '@/components/RaceSection'
import { Share } from '@/components/Share'
import { SourceLine } from '@/components/SourceLine'
import { aBallotFor, allCandidates, candidate, presidentialRace, source } from '@/lib/data'
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

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { race, c } = await of(params)
  const ticket = TICKET_OFFICES.includes(race.office)
  const ballot = aBallotFor(race.id)
  const url = `${SITE_URL}${candidatePath(c.id)}`
  const name = c.candidate.name || noCandidateText(c)
  const showBackground = race.office === 'president' && presidentialBackgroundReady()
  const inec = source(c.provenance.source_id)
  return (
    <>
      <JsonLd data={pageGraph(candidatePath(c.id), candidateTitle(race, c), [['Home', '/'], [raceTitle(race), `${ballot.path}`], [name, candidatePath(c.id)]])} />
      <nav aria-label="Breadcrumb" className="crumbs">
        <a href="/">All states</a>
        <span aria-hidden="true"> / </span>
        <a href={`${ballot.path}#race-${race.id}`}>{raceTitle(race)}</a>
      </nav>
      <h1 data-candidate-id={c.id}>{name}</h1>
      <div className="party-head">
        <PartyLogo party={c.party} size={64} eager />
        <p className="party">
          <span className="acronym" aria-hidden="true">{c.party}</span>
          {' '}
          <span className="party-name">{c.party_name ?? NOT_PROVIDED}</span>
        </p>
      </div>
      <SourceLine id="inec-parties" what="Full party name and logo" />
      <p>
        {race.election === 'feb-2027' ? 'Candidate in the 6 February 2027 election:' : 'Candidate in the 16 January 2027 election:'}
        {' '}
        <a href={`${ballot.path}#race-${race.id}`}>{raceTitle(race)}</a>
      </p>

      <section aria-labelledby="inec" className="panel">
        <h2 id="inec">From INEC’s final list</h2>
        {ticket && <p className="position">{c.candidate.position}</p>}
        <PersonFields p={c.candidate} who="candidate" notes={c.printing_notes} />
        <dl className="fields">
          <dt>Remarks</dt>
          <dd>{c.remarks ? <Value text={c.remarks} note={noteFor(c.printing_notes, 'running_mate', 'remarks') ?? noteFor(c.printing_notes, 'candidate', 'remarks')} /> : 'No remark in INEC’s list'}</dd>
        </dl>
        <SourceLine id={c.provenance.source_id} what={`Source, page ${c.provenance.page}, row ${c.provenance.sn}`} href={`${inec.file_url}#page=${c.provenance.page}`} />
      </section>

      {ticket && c.running_mate && (
        <section aria-labelledby="mate" className="panel">
          <h2 id="mate">
            {mateLabel(race)}
            {': '}
            {c.running_mate.name || NOT_PROVIDED}
          </h2>
          <p className="position">{c.running_mate.position}</p>
          <PersonFields p={c.running_mate} who="running_mate" notes={c.printing_notes} />
        </section>
      )}

      {showBackground && (
        <section aria-labelledby="background" className="panel">
          <h2 id="background">Background</h2>
          {([['Candidate', c.candidate], ['Running mate', c.running_mate]] as const).map(([role, p]) => (
            <div key={role}>
              <h3>
                {role}
                {': '}
                {p?.name || NOT_PROVIDED}
              </h3>
              {p?.background
                ? <Background bg={p.background} level={4} />
                : (
                    <div className="background">
                      <h4>Public offices held</h4>
                      <p>INEC’s list names no candidate for this party.</p>
                      <h4>Party history</h4>
                      <p>INEC’s list names no candidate for this party.</p>
                    </div>
                  )}
            </div>
          ))}
        </section>
      )}

      <Share
        label="Share"
        text={`Who’s on my ballot? ${c.candidate.name ? `${c.candidate.name} (${c.party})` : `${c.party}: ${noCandidateText(c)}`}, ${raceTitle(race)}, ${ELECTION_DAY[race.election]}:`}
        url={url}
        picture={picture(race)}
      />

      <section aria-labelledby="correct">
        <h2 id="correct">Report a correction</h2>
        <p>
          If something here doesn’t match INEC’s documents, tell us what and where INEC says so. We check every report against INEC’s own documents.
        </p>
        <ul className="link-list">
          <li><a href={correctionHref(c.id, url, c.candidate.name)}>Email a correction</a></li>
          <li><a href="/corrections/">Corrections made so far</a></li>
        </ul>
      </section>
    </>
  )
}
