import type { Metadata, Viewport } from 'next'

import { Credit } from '@/components/Credit'
import { SourceLine } from '@/components/SourceLine'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

import './globals.css'

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  referrer: 'no-referrer',
  metadataBase: new URL(SITE_URL),
}

// Always light (D-039): light form controls, and a browser bar in the header's national green.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, colorScheme: 'light', themeColor: '#008751' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="site-header-in">
            <a href="/" className="site-name">
              <svg className="site-mark" viewBox="11 8 46 51" width="24" height="27" aria-hidden="true" focusable="false">
                <rect x="14" y="11" width="27" height="35" rx="3.5" fill="#fff" />
                <path d="M19.5 20h16M19.5 27.5h11" stroke="#008751" strokeWidth="3.4" strokeLinecap="round" />
                <g transform="rotate(-12 41 42)">
                  <ellipse cx="41" cy="42" rx="11.5" ry="14" fill="#fff" stroke="#008751" strokeWidth="2.6" />
                  <path d="M40.32 45.85A2.2 3 0 1 1 42.47 45.23M39.21 50.04A5.8 7.4 0 1 1 44.57 48.83M38.1 54.22A9.4 11.8 0 1 1 46.26 52.78" fill="none" stroke="#008751" strokeWidth="2.3" strokeLinecap="round" />
                </g>
              </svg>
              Who’s on my ballot?
            </a>
            <nav aria-label="Site" className="site-nav-list">
              <a href="/election-day/" className="site-nav"><span>Election day</span></a>
              <a href="/results/" className="site-nav"><span>Results</span></a>
              <a href="/about/" className="site-nav"><span>About</span></a>
            </nav>
          </div>
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
          <div className="footer-row">
            <p className="footer-printed">Shown exactly as INEC printed them.</p>
            <p className="footer-correct"><a className="btn" href="/corrections/">Report a correction</a></p>
          </div>
          <Credit />
        </footer>
      </body>
    </html>
  )
}
