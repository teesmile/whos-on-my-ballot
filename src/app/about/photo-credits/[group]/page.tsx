import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { CreditList, creditGroups } from '@/components/PhotoCredits'
import { pageGraph, pageMeta } from '@/lib/seo'

const INDEX = '/about/photo-credits/'
const groupOf = (key: string) => creditGroups().find(g => g.key === key)!
const titleOf = (name: string) => (name === 'President' ? 'Photo credits: President' : `Photo credits: ${name}`)

export const dynamicParams = false
export function generateStaticParams() {
  return creditGroups().map(g => ({ group: g.key }))
}

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }): Promise<Metadata> {
  const g = groupOf((await params).group)
  const where = g.name === 'President' ? 'the presidential candidates' : `candidates in ${g.name}`
  return pageMeta({ title: titleOf(g.name), path: `${INDEX}${g.key}/`, description: `Where each photo of ${where} on this site comes from: source, author and licence where there is one, and when it was retrieved.` })
}

export default async function PhotoCreditsGroup({ params }: { params: Promise<{ group: string }> }) {
  const g = groupOf((await params).group)
  const path = `${INDEX}${g.key}/`
  return (
    <>
      <JsonLd data={pageGraph(path, titleOf(g.name), [['Home', '/'], ['About', '/about/'], ['Photo credits', INDEX], [titleOf(g.name), path]])} />
      <nav aria-label="Breadcrumb" className="crumbs"><a href="/about/">About</a><a href={INDEX}>Photo credits</a></nav>
      <h1>{titleOf(g.name)}</h1>
      <p className="lead">{`${g.ids.length} ${g.ids.length === 1 ? 'photo' : 'photos'}, each cropped to a square for this site.`}</p>
      <CreditList ids={g.ids} />
    </>
  )
}
