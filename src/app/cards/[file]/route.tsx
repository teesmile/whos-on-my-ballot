import { ImageResponse } from 'next/og'

import { raceTitle } from '@/components/RaceSection'
import { race, races } from '@/lib/data'

// One share card per race, rendered at build time to /cards/<race-id>.png (1200x630, the Open Graph size).
// Greys only and the same template for every race: no party colours, logos or photos (the working rules §1).
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return races().map(r => ({ file: `${r.id}.png` }))
}

const INK = '#1a1a1a'
const MUTED = '#545454'
const LINE = '#c8c8c8'
const PAPER = '#ffffff'

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const r = race(file.replace(/\.png$/, ''))
  const n = r.candidates.length
  const columns = n > 8 ? 2 : 1
  const rows = Math.ceil(n / columns)
  const rowHeight = Math.floor(392 / rows)
  // Fit the longest name on one line: column width >= font * (acronym column + name length * glyph width).
  const columnWidth = columns === 2 ? 532 : 1104
  const longest = Math.max(...r.candidates.map(c => (c.candidate.name || 'Not provided in INEC’s list').length))
  const font = Math.max(14, Math.min(30, Math.floor(rowHeight * 0.62), Math.floor(columnWidth / (3.4 + 0.74 * longest))))
  const title = raceTitle(r)
  const titleSize = title.length > 60 ? 34 : title.length > 40 ? 40 : 46
  const cols = Array.from({ length: columns }, (_, i) => r.candidates.slice(i * rows, (i + 1) * rows))

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, color: INK, padding: '36px 48px', fontFamily: 'Geist' }}>
        <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>Who’s on my ballot? · 16 January 2027</div>
        <div style={{ display: 'flex', fontSize: titleSize, marginTop: 6, lineHeight: 1.15 }}>{title}</div>
        <div style={{ display: 'flex', flex: 1, marginTop: 18, borderTop: `2px solid ${INK}`, paddingTop: 14, gap: 40 }}>
          {cols.map((col, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              {col.map(c => (
                <div key={c.id} style={{ display: 'flex', height: rowHeight, alignItems: 'center', fontSize: font, borderBottom: `1px solid ${LINE}` }}>
                  <div style={{ display: 'flex', width: font * 3.4, color: MUTED, flexShrink: 0 }}>{c.party}</div>
                  <div style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                    {c.candidate.name || 'Not provided in INEC’s list'}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: MUTED, marginTop: 14 }}>
          <div style={{ display: 'flex' }}>{`${n} candidates in the order of INEC’s list. Source: INEC final list, 31 Oct 2026.`}</div>
          <div style={{ display: 'flex' }}>ballot.anthonyugwuja.dev</div>
        </div>
        <div style={{ display: 'flex', fontSize: 16, color: MUTED, marginTop: 4 }}>Independent project. Not affiliated with INEC.</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
