import type { Background as B, BackgroundCitation } from '@/lib/data'

import { formatDate } from './Candidate'

export const NONE_FOUND = 'No entry found in independent sources.'

/**
 * The page's numbered sources. Every fact keeps a small numbered marker that jumps to its entry in the one "Sources" list
 * at the end of the page (owner feedback, 11 Nov 2026). The same source cited twice keeps one number.
 */
export interface SourceEntry { key: string, href: string, publisher: string, detail: string | null, published: string | null, retrieved: string, sourceId?: string }
export class Refs {
  list: SourceEntry[] = []
  add(e: SourceEntry): number {
    const i = this.list.findIndex(x => x.key === e.key)
    if (i >= 0) return i + 1
    this.list.push(e)
    return this.list.length
  }

  cite(c: BackgroundCitation): number {
    return this.add({ key: c.url, href: c.url, publisher: c.publisher, detail: null, published: c.published === 'unknown' ? null : c.published, retrieved: c.retrieved })
  }
}

export function Ref({ n }: { n: number }) {
  return <a className="ref" href={`#src-${n}`} aria-label={`Source ${n}`}><span aria-hidden="true">{n}</span></a>
}

/** The one list of sources at the end of a page: publisher, publication date and retrieval date, numbered to match. */
export function SourceList({ refs }: { refs: Refs }) {
  return (
    <section aria-labelledby="sources" className="sources-section">
      <h2 id="sources">Sources</h2>
      <ol className="sources">
        {refs.list.map((s, i) => (
          <li key={s.key} id={`src-${i + 1}`} data-source={s.sourceId}>
            <a className="src-link" href={s.href}>
              <span className="src-n" aria-hidden="true">{i + 1}</span>
              <span>
                <strong>{s.publisher}</strong>
                {s.detail && `: ${s.detail}`}
                {s.published && (
                  <>
                    {', published '}
                    <time dateTime={s.published}>{formatDate(s.published)}</time>
                  </>
                )}
                {'. Retrieved '}
                <time dateTime={s.retrieved.slice(0, 10)}>{formatDate(s.retrieved)}</time>
                .
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

const DATED = /^(.*), ((?:from )?\d{4}(?:-\d{4})?(?: election)?)$/

/** A role and its dates, split where the entry gives dates; the words themselves are never changed. */
export function splitEntry(text: string): { role: string, when: string | null } {
  const m = DATED.exec(text)
  if (!m) return { role: text, when: null }
  return { role: m[1], when: m[2].replace(/^from/, 'From') }
}

/** Newest first: ongoing roles, then by the last year, then the first; undated entries after, in their recorded order. */
export function timelineOrder<T extends { text: string }>(list: T[]): T[] {
  const key = (t: string) => {
    const { when } = splitEntry(t)
    if (!when) return null
    const years = when.match(/\d{4}/g)!.map(Number)
    return [/^From/.test(when) ? 9999 : years.at(-1)!, years[0]]
  }
  return list.map((e, i) => ({ e, i, k: key(e.text) })).sort((a, b) => {
    if (!a.k || !b.k) return a.k ? -1 : b.k ? 1 : a.i - b.i
    return b.k[0] - a.k[0] || b.k[1] - a.k[1] || a.i - b.i
  }).map(x => x.e)
}

export interface TimelineItem { role: string, when: string | null, note: string | null, refs: number[] }

/** Numbers a person's entries in the order they will show; done before rendering, so the numbers always match the list. */
export function timelineItems(list: B['public_offices'], refs: Refs): TimelineItem[] {
  return timelineOrder(list).map(e => ({ ...splitEntry(e.text), note: e.note ?? null, refs: e.citations.map(c => refs.cite(c)) }))
}

/** One person's roles as a timeline of dated entries, each with its numbered source markers. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="timeline-none">{NONE_FOUND}</p>
  return (
    <ol className="timeline">
      {items.map(e => (
        <li key={`${e.role}${e.when}`}>
          <span className="when">{e.when ?? 'Undated'}</span>
          <span className="role">
            {e.role}
            {e.note && <span className="entry-note">{e.note}</span>}
          </span>
          <span className="refs">{e.refs.map(n => <Ref key={n} n={n} />)}</span>
        </li>
      ))}
    </ol>
  )
}

export function BackgroundMethod({ researched }: { researched: string }) {
  return (
    <p className="method">
      Researched
      {' '}
      <time dateTime={researched}>{formatDate(researched)}</time>
      {' '}
      from independent sources only: news organisations and official records. Never Wikipedia, social media, or a candidate’s or party’s own material.
      Every entry is numbered to its source in the list at the end of this page.
    </p>
  )
}
