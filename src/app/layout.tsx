import type { Metadata, Viewport } from 'next'

import { INEC_2027, INEC_LOCATOR } from '@/components/RaceSection'

import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Who’s on my ballot?', template: '%s · Who’s on my ballot?' },
  description: 'Every candidate on your ballot in Nigeria’s 2027 elections, side by side, from INEC’s published lists.',
  referrer: 'no-referrer',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <a href="/" className="site-name">Who’s on my ballot?</a>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <p className="affiliation">
            Independent project. Not affiliated with or endorsed by INEC (Independent National Electoral Commission).
          </p>
          <p>
            Candidates: INEC final lists of candidates (updated 31 October 2026). Polling units: INEC Polling Unit Locator.
            Shown exactly as INEC printed them.
          </p>
          <p>
            <a href={INEC_LOCATOR}>INEC Polling Unit Locator</a>
            {' · '}
            <a href={INEC_2027}>INEC 2027 general elections</a>
          </p>
          <p>No tracking, no ads, no accounts. What you type stays in your browser.</p>
        </footer>
      </body>
    </html>
  )
}
