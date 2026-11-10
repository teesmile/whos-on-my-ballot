import type { Background as B, BackgroundCitation } from '@/lib/data'

import { formatDate } from './Candidate'

export const NONE_FOUND = 'No entry found in independent sources.'

function Cite({ c }: { c: BackgroundCitation }) {
  return (
    <p className="cite">
      <a href={c.url}>
        {c.publisher}
        {': '}
        {c.title}
        {c.published !== 'unknown' && (
          <>
            {', '}
            <time dateTime={c.published}>{formatDate(c.published)}</time>
          </>
        )}
        , retrieved
        {' '}
        <time dateTime={c.retrieved}>{formatDate(c.retrieved)}</time>
      </a>
    </p>
  )
}

function Entries({ title, list, level }: { title: string, list: B['public_offices'], level: 3 | 4 }) {
  const H = level === 3 ? 'h3' : 'h4'
  return (
    <>
      <H>{title}</H>
      {list.length
        ? (
            <ul className="entries">
              {list.map(e => (
                <li key={e.text}>
                  <p className="entry">{e.text}</p>
                  {e.note && <p className="entry-note">{e.note}</p>}
                  {e.citations.map(c => <Cite key={c.url} c={c} />)}
                </li>
              ))}
            </ul>
          )
        : <p>{NONE_FOUND}</p>}
    </>
  )
}

/** The same two fields for every presidential candidate and running mate (D-013). */
export function Background({ bg, level }: { bg: B, level: 3 | 4 }) {
  return (
    <div className="background" data-background>
      <Entries title="Public offices held" list={bg.public_offices} level={level} />
      <Entries title="Party history" list={bg.party_history} level={level} />
      <p className="method">
        Researched
        {' '}
        <time dateTime={bg.researched}>{formatDate(bg.researched)}</time>
        {' '}
        from independent sources only: news organisations and official records. Never Wikipedia, social media, or a candidate’s or party’s own material.
        Every entry links to its source.
      </p>
    </div>
  )
}
