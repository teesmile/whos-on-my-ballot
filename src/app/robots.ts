import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

// Follows the one site address (D-032). The per-state search files are for the lookup, not for search results.
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: '/data/' }], sitemap: `${SITE_URL}/sitemap.xml` }
}
