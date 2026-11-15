import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { creditGroups } from '@/components/PhotoCredits'
import { pageGraph, pageMeta } from '@/lib/seo'

const TITLE = 'Photo credits'
const PATH = '/about/photo-credits/'

export const metadata: Metadata = pageMeta({
  title: 'Candidate photo credits, by state', path: PATH,
  description: 'Where every candidate photo on this site comes from: the source, its author and licence where there is one, and when it was retrieved, listed by state.',
})

export default function PhotoCreditsIndex() {
  const groups = creditGroups()
  const total = groups.reduce((n, g) => n + g.ids.length, 0)
  return (
    <>
      <JsonLd data={pageGraph(PATH, TITLE, [['Home', '/'], ['About', '/about/'], [TITLE, PATH]])} />
      <nav aria-label="Breadcrumb" className="crumbs"><a href="/about/">About</a></nav>
      <h1>{TITLE}</h1>
      <p className="lead">
        {`The source of each of the ${total.toLocaleString('en-NG')} candidate photos on this site, listed by state. Every photo is cropped to a square for this site. The owner of any photo can ask for it to be removed through the corrections address on the About page.`}
      </p>
      <ul className="link-list credit-groups">
        {groups.map(g => (
          <li key={g.key}>
            <a href={`${PATH}${g.key}/`}>{g.name === 'President' ? 'President' : g.name}</a>
            <span className="credit-count">{` ${g.ids.length} ${g.ids.length === 1 ? 'photo' : 'photos'}`}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
