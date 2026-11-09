import type { Metadata, Viewport } from 'next'

import { SourceLine } from '@/components/SourceLine'

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
          <SourceLine id="president" what="Candidates (INEC final lists, updated 31 October 2026)" />
          <SourceLine id="inec-pu-locator" what="Polling units" />
          <SourceLine id="inec-constituencies-workbook" what="Constituencies" />
          <SourceLine id="inec-parties" what="Parties" />
          <p>Shown exactly as INEC printed them.</p>
          <p>No tracking, no ads, no accounts. What you type stays in your browser.</p>
        </footer>
      </body>
    </html>
  )
}
