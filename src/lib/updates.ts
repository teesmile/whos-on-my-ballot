import fs from 'node:fs'
import path from 'node:path'

import { source } from '@/lib/data'

/**
 * Updates (owner, 15 Nov 2026): dated entries about INEC's candidate lists, INEC's own dates and notices, results on the
 * election nights, and site news that matters to a voter. Facts only, each backed by INEC's own publication or the site's own
 * data (never a news report alone), each with its source and links to the pages it touches. Written in
 * data/overrides/updates.json; this module checks every entry, so a broken one fails the build.
 */
export type UpdateSource = { label: string, inec?: string, href?: string }
export type Update = { slug: string, date: string, headline: string, body: string[], source: UpdateSource, links: { label: string, href: string }[] }

let cache: Update[] | null = null

function check(u: Update): Update {
  const where = `updates.json "${u.slug}"`
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(u.slug)) throw new Error(`${where}: the address must be lower-case words joined by hyphens`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(u.date)) throw new Error(`${where}: date must be YYYY-MM-DD`)
  if (u.body.length < 2 || u.body.length > 5) throw new Error(`${where}: two to five sentences`)
  const text = [u.headline, ...u.body, u.source.label, ...u.links.map(l => l.label)].join(' ')
  if (/[\u2013\u2014]/.test(text)) throw new Error(`${where}: plain hyphens only`)
  if (!u.source.inec && !u.source.href) throw new Error(`${where}: every entry needs a source`)
  if (u.source.inec) source(u.source.inec) // throws if INEC's source is unknown
  if (u.source.href && !u.source.href.startsWith('/')) throw new Error(`${where}: the site's own source must be one of its pages`)
  if (!u.links.length || u.links.some(l => !l.href.startsWith('/'))) throw new Error(`${where}: links go to the site's own pages`)
  return u
}

/** Every entry, newest first; entries of the same day keep the order they are written in (newest first in the file). */
export function updates(): Update[] {
  if (cache) return cache
  const list = (JSON.parse(fs.readFileSync(path.resolve('data/overrides/updates.json'), 'utf8')) as Update[]).map(check)
  const slugs = new Set(list.map(u => u.slug))
  if (slugs.size !== list.length) throw new Error('updates.json: every entry needs its own address')
  cache = [...list].sort((a, b) => b.date.localeCompare(a.date))
  return cache
}

export const updatePath = (u: Update) => `/updates/${u.slug}/`

/** The source's address: INEC's page for an INEC source, or the site's own page. */
export function sourceHref(s: UpdateSource): string {
  if (s.inec) { const x = source(s.inec); return x.page_url ?? x.archive_url ?? x.file_url }
  return s.href!
}
