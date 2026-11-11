import type { MetadataRoute } from 'next'

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

export const dynamic = 'force-static'

/** The web app manifest: the mark's icons (D-047), the national green as the theme, a white page behind it. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'My ballot',
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#008751',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
