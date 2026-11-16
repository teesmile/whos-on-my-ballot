import type { Metadata } from 'next'

import { formatDate } from '@/components/Candidate'
import { JsonLd } from '@/components/JsonLd'
import { pageGraph, pageMeta } from '@/lib/seo'
import { updatePath, updates } from '@/lib/updates'

const TITLE = 'Updates'
const PATH = '/updates/'

export const metadata: Metadata = {
  ...pageMeta({ title: 'Updates: INEC lists, dates and new on this site', path: PATH, description: 'Dated updates on the 2027 elections: INEC’s candidate lists, dates and notices, results, and what is new on this site. Facts only, each sourced.' }),
  alternates: { canonical: PATH, types: { 'application/rss+xml': [{ url: '/updates/feed.xml', title: 'Who’s on my ballot? updates' }] } },
}

export default function Updates() {
  const list = updates()
  return (
    <>
      <JsonLd data={pageGraph(PATH, TITLE, [['Home', '/'], [TITLE, PATH]])} />
      <h1>{TITLE}</h1>
      <p className="lead">
        Changes to INEC’s candidate lists, INEC’s dates and notices, results on the election nights, and what is new on this site.
        Facts only, each with its source. Also as a
        {' '}
        <a href="/updates/feed.xml">feed</a>
        .
      </p>
      <ol className="updates">
        {list.map(u => (
          <li key={u.slug}>
            <article>
              <p className="update-date"><time dateTime={u.date}>{formatDate(u.date)}</time></p>
              <h2><a href={updatePath(u)}>{u.headline}</a></h2>
              <p>{u.body[0]}</p>
            </article>
          </li>
        ))}
      </ol>
    </>
  )
}
