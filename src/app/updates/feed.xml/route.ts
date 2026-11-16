import { SITE_NAME, SITE_URL } from '@/lib/site'
import { sourceHref, updatePath, updates } from '@/lib/updates'

// The Updates page as an RSS 2.0 feed (owner, 15 Nov 2026): every entry, newest first, built with the site.
export const dynamic = 'force-static'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rfc822 = (d: string) => new Date(`${d}T00:00:00Z`).toUTCString()
const abs = (href: string) => (href.startsWith('/') ? `${SITE_URL}${href}` : href)

export function GET() {
  const list = updates()
  const items = list.map((u) => {
    const link = `${SITE_URL}${updatePath(u)}`
    const body = `${u.body.join(' ')} Source: ${u.source.label} (${abs(sourceHref(u.source))}).`
    return `<item><title>${esc(u.headline)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${rfc822(u.date)}</pubDate><description>${esc(body)}</description></item>`
  }).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(SITE_NAME)} updates</title><link>${SITE_URL}/updates/</link><atom:link href="${SITE_URL}/updates/feed.xml" rel="self" type="application/rss+xml"/><description>Dated updates on Nigeria’s 2027 elections: INEC’s candidate lists, dates and notices, results, and what is new on the site. Facts only, each with its source.</description><language>en-NG</language>${list[0] ? `<lastBuildDate>${rfc822(list[0].date)}</lastBuildDate>` : ''}${items}</channel></rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
