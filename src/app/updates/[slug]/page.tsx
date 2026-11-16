import type { Metadata } from 'next'

import { formatDate } from '@/components/Candidate'
import { JsonLd } from '@/components/JsonLd'
import { absolute, pageGraph, pageMeta } from '@/lib/seo'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { sourceHref, updatePath, updates } from '@/lib/updates'

const find = (slug: string) => updates().find(u => u.slug === slug)!

export const dynamicParams = false
export function generateStaticParams() {
  return updates().map(u => ({ slug: u.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const u = find((await params).slug)
  const description = u.body.join(' ').slice(0, 152).replace(/\s+\S*$/, '') + '…'
  return {
    ...pageMeta({ title: u.headline, path: updatePath(u), description }),
    alternates: { canonical: updatePath(u), types: { 'application/rss+xml': [{ url: '/updates/feed.xml', title: 'Who’s on my ballot? updates' }] } },
  }
}

export default async function UpdatePage({ params }: { params: Promise<{ slug: string }> }) {
  const u = find((await params).slug)
  const path = updatePath(u)
  const graph = pageGraph(path, u.headline, [['Home', '/'], ['Updates', '/updates/'], [u.headline, path]])
  const article = {
    '@type': 'NewsArticle', '@id': `${absolute(path)}#article`, 'headline': u.headline, 'datePublished': u.date, 'dateModified': u.date,
    'mainEntityOfPage': { '@id': `${absolute(path)}#webpage` }, 'author': { '@id': `${SITE_URL}/#organization` }, 'publisher': { '@id': `${SITE_URL}/#organization` },
    'isAccessibleForFree': true, 'inLanguage': 'en-NG', 'about': SITE_NAME,
  }
  return (
    <>
      <JsonLd data={{ ...graph, '@graph': [...graph['@graph'], article] }} />
      <nav aria-label="Breadcrumb" className="crumbs"><a href="/updates/">Updates</a></nav>
      <article className="update">
        <p className="update-date"><time dateTime={u.date}>{formatDate(u.date)}</time></p>
        <h1>{u.headline}</h1>
        {u.body.map((s, i) => <p key={i}>{s}</p>)}
        <p className="cite"><a href={sourceHref(u.source)}>{`Source: ${u.source.label}`}</a></p>
        <h2>Pages this touches</h2>
        <ul className="link-list">
          {u.links.map(l => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
        </ul>
      </article>
    </>
  )
}
