import type { Metadata, Viewport } from 'next'

import { SourceLine } from '@/components/SourceLine'
import { BUILT_BY, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

import './globals.css'

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  referrer: 'no-referrer',
  metadataBase: new URL(SITE_URL),
}

// Always light (D-039): the page asks the browser for its light form controls and a white browser bar.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, colorScheme: 'light', themeColor: '#ffffff' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <a href="/" className="site-name">Who’s on my ballot?</a>
          <a href="/election-day/" className="site-nav">Election day</a>
          <a href="/about/" className="site-nav">About</a>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <p className="affiliation">
            Not affiliated with INEC.
          </p>
          <SourceLine id="president" what="Candidates (INEC final lists, updated 31 October 2026)" />
          <SourceLine id="inec-pu-locator" what="Polling units" />
          <SourceLine id="inec-constituencies-workbook" what="Constituencies" />
          <SourceLine id="inec-parties" what="Parties" />
          <p>Shown exactly as INEC printed them.</p>
          <ul className="link-list"><li><a href="/corrections/">Corrections</a></li></ul>
          <p>No tracking, no ads, no accounts. What you type stays in your browser.</p>
          <p className="credit">
            Built by
            {' '}
            <a href={BUILT_BY.url}>{BUILT_BY.name}</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
