import fs from 'node:fs'
import path from 'node:path'

import type { Metadata } from 'next'

import { formatDate } from '@/components/Candidate'
import { JsonLd } from '@/components/JsonLd'
import { pageGraph, pageMeta } from '@/lib/seo'
import { CORRECTIONS_EMAIL } from '@/lib/site'

export const metadata: Metadata = pageMeta({
  title: 'Corrections log', suffix: true, path: '/corrections/',
  description: 'Every correction accepted on this site, with its date and the INEC source that settled it.',
})

interface Correction { date: string, page: string, field: string, was: string, now: string, source_title: string, source_url: string }

export default function Corrections() {
  const log = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'corrections.json'), 'utf8')) as Correction[]
  return (
    <>
      <JsonLd data={pageGraph('/corrections/', 'Corrections log', [['Home', '/'], ['Corrections', '/corrections/']])} />
      <h1>Corrections</h1>
      <p>
        Every accepted correction is listed here with its date and the source that settled it. Report one by email to
        {' '}
        <a href={`mailto:${CORRECTIONS_EMAIL}`}>{CORRECTIONS_EMAIL}</a>
        .
      </p>
      {log.length === 0
        ? <p>No corrections have been made yet.</p>
        : (
            <ul className="entries">
              {log.map(x => (
                <li key={`${x.date}${x.page}${x.field}`}>
                  <p className="entry">
                    <time dateTime={x.date}>{formatDate(x.date)}</time>
                    {': '}
                    <a href={x.page}>{x.field}</a>
                    {` changed from “${x.was}” to “${x.now}”.`}
                  </p>
                  <p className="cite"><a href={x.source_url}>{`Source: ${x.source_title}`}</a></p>
                </li>
              ))}
            </ul>
          )}
    </>
  )
}
