import { ImageResponse } from 'next/og'

import { raceTitle } from '@/components/RaceSection'
import { allRaces, race } from '@/lib/data'
import { cardSourceCaption, SITE_HOST } from '@/lib/site'

// One share card per race, rendered at build time to /cards/<race-id>.png (1200x630, the Open Graph size).
// Greys only and the same template for every race: no party colours, logos or photos (the working rules §1).
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return [{ file: 'site.png' }, ...allRaces().map(r => ({ file: `${r.id}.png` }))]
}

const INK = '#1a1a1a'
const MUTED = '#545454'
const LINE = '#c8c8c8'
const PAPER = '#ffffff'

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (file === 'site.png') return siteCard()
  const r = race(file.replace(/\.png$/, ''))
  const n = r.candidates.length
  const columns = n > 8 ? 2 : 1
  const rows = Math.ceil(n / columns)
  const title = raceTitle(r)
  const titleSize = title.length > 60 ? 34 : title.length > 40 ? 40 : 46
  // Estimate title lines (Geist is about 0.55 em per character at these sizes), then give the candidate rows exactly
  // the height that is left, so a wrapped title can never push the footer over a candidate (review 3).
  const titleLines = Math.ceil((title.length * titleSize * 0.55) / 1104)
  const listHeight = 630 - 72 /* padding */ - 28 /* kicker */ - titleLines * titleSize * 1.15 - 34 /* rule */ - 64 /* footer */
  const rowHeight = Math.floor((listHeight - 16 /* the list's top border and padding */) / rows)
  // Fit the longest name on one line: column width >= font * (acronym column + name length * glyph width).
  const columnWidth = columns === 2 ? 532 : 1104
  const longest = Math.max(...r.candidates.map(c => (c.candidate.name || 'Not provided in INEC’s list').length))
  const font = Math.max(14, Math.min(30, Math.floor(rowHeight * 0.62), Math.floor(columnWidth / (3.9 + 0.74 * longest))))
  const caption = cardSourceCaption(r.sources)
  const day = r.election === 'feb-2027' ? '6 February 2027' : '16 January 2027'
  const cols = Array.from({ length: columns }, (_, i) => r.candidates.slice(i * rows, (i + 1) * rows))

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, color: INK, padding: '36px 48px', fontFamily: 'Geist' }}>
        <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>{`Who’s on my ballot? · ${day}`}</div>
        <div style={{ display: 'flex', fontSize: titleSize, marginTop: 6, lineHeight: 1.15 }}>{title}</div>
        <div style={{ display: 'flex', height: listHeight, marginTop: 18, borderTop: `2px solid ${INK}`, paddingTop: 14, gap: 40, overflow: 'hidden' }}>
          {cols.map((col, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              {col.map(c => (
                <div key={c.id} style={{ display: 'flex', height: rowHeight, flexShrink: 0, alignItems: 'center', fontSize: font, borderBottom: `1px solid ${LINE}` }}>
                  <div style={{ display: 'flex', width: font * 3.9, color: MUTED, flexShrink: 0 }}>{c.party}</div>
                  <div style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                    {c.candidate.name || 'Not provided in INEC’s list'}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', fontSize: 18, color: MUTED, marginTop: 'auto' }}>{caption}</div>
        <div style={{ display: 'flex', fontSize: 16, color: MUTED, marginTop: 4 }}>
          {`${n} candidates in the order of INEC’s list · ${SITE_HOST} · Independent project, not affiliated with INEC`}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

/** The card for pages without a race of their own (home, states, wards, election day, about): the same greys, no candidates. */
function siteCard() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, color: INK, padding: '72px 72px 48px', fontFamily: 'Geist' }}>
        <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>Nigeria’s 2027 elections · 16 January and 6 February</div>
        <div style={{ display: 'flex', fontSize: 84, marginTop: 24, lineHeight: 1.1 }}>Who’s on my ballot?</div>
        <div style={{ display: 'flex', fontSize: 38, marginTop: 28, lineHeight: 1.3, borderTop: `2px solid ${INK}`, paddingTop: 28 }}>
          Every candidate on your ballot, side by side, from INEC’s published lists.
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: MUTED, marginTop: 'auto' }}>
          {`${SITE_HOST} · Independent project, not affiliated with or endorsed by INEC`}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
