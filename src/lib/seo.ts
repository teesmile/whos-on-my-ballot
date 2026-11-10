/**
 * Page metadata and structured data from one place (D-032), all derived from SITE_URL.
 * Next.js replaces the root layout's openGraph when a route sets its own, so every route sets a complete set here.
 */
import type { Metadata } from 'next'

import { SITE_CARD, SITE_CARD_ALT, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site'

export interface PageMetaInput {
  /** The page's title. With `suffix`, the site name is added (short pages only, so titles stay under 60 characters). */
  title: string
  suffix?: boolean
  description: string
  /** The page's own path, ending in "/" (its canonical). */
  path: string
  image?: { url: string, alt: string }
}

export const absolute = (path: string) => `${SITE_URL}${path}`

export function pageMeta({ title, suffix = false, description, path, image }: PageMetaInput): Metadata {
  // the site name is added only where the title stays under 60 characters with it
  const full = suffix && `${title} · ${SITE_NAME}`.length <= 60 ? `${title} · ${SITE_NAME}` : title
  const img = image ?? { url: SITE_CARD, alt: SITE_CARD_ALT }
  return {
    title: { absolute: full },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website', siteName: SITE_NAME, locale: 'en_NG', title: full, description, url: absolute(path),
      images: [{ url: img.url, width: 1200, height: 630, alt: img.alt }],
    },
    twitter: { card: 'summary_large_image', title: full, description, images: [{ url: img.url, alt: img.alt }] },
  }
}

const WEBSITE = `${SITE_URL}/#website`
const ORGANIZATION = `${SITE_URL}/#organization`

/** Home only: the site and the project, each defined once and referenced by @id from every other page. */
export function homeGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': ORGANIZATION, 'name': SITE_NAME, 'url': `${SITE_URL}/`,
        'logo': absolute('/icon.png'), 'description': 'A non-partisan civic project. Not affiliated with INEC.',
      },
      {
        '@type': 'WebSite', '@id': WEBSITE, 'name': SITE_NAME, 'url': `${SITE_URL}/`, 'description': SITE_DESCRIPTION,
        'inLanguage': 'en-NG', 'publisher': { '@id': ORGANIZATION },
      },
    ],
  }
}

/** Every other page: a WebPage in the site, with its breadcrumb trail ([name, path] from home to this page). */
export function pageGraph(path: string, name: string, crumbs: [string, string][]) {
  const url = absolute(path)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${url}#webpage`, url, name, 'inLanguage': 'en-NG',
        'isPartOf': { '@id': WEBSITE }, 'breadcrumb': { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        'itemListElement': crumbs.map(([n, p], i) => ({ '@type': 'ListItem', 'position': i + 1, 'name': n, 'item': absolute(p) })),
      },
    ],
  }
}
