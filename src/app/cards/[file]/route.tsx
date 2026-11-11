import fs from 'node:fs'
import path from 'node:path'

import { ImageResponse } from 'next/og'

import { allRaces, logoPngDataUrl, race } from '@/lib/data'
import { picture } from '@/lib/share'
import { cardSourceCaption, SITE_HOST } from '@/lib/site'

// One share card per race, rendered at build time to /cards/<race-id>.png (1200x630, the Open Graph size).
// The same template for every race: white and the national green, the race's first group (D-042) with each party's logo
// from INEC's register (D-043), then how many more candidates there are. Never a candidate photo.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return [{ file: 'site.png' }, ...allRaces().map(r => ({ file: `${r.id}.png` }))]
}

// The site's mark (D-047), from the same file the browser tab uses.
const MARK = `data:image/svg+xml;base64,${fs.readFileSync(path.join(process.cwd(), 'src/app/icon.svg')).toString('base64')}`
const INK = '#1a1a1a'
const MUTED = '#555555'
const LINE = '#d9d9d9'
const PAPER = '#ffffff'
const GREEN = '#008751'
const DEEP = '#00552f'
const BAND = '#e8f5ee'

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (file === 'site.png') return siteCard()
  const r = race(file.replace(/\.png$/, ''))
  const p = picture(r)
  const n = p.tiles.length + (p.more ? 1 : 0)
  const titleSize = p.title.length > 70 ? 28 : p.title.length > 48 ? 34 : 42
  const longest = Math.max(...p.tiles.map(([, name]) => name.length))
  const nameSize = longest > 44 ? 18 : longest > 32 ? 20 : 23
  const rows = Math.ceil(n / 3)
  const tileH = rows === 1 ? 300 : 182
  const caption = cardSourceCaption(r.sources)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, color: INK, fontFamily: 'Geist' }}>
        <div style={{ display: 'flex', flexDirection: 'column', background: GREEN, color: '#fff', padding: '20px 48px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG at build time */}
            <img src={MARK} width={30} height={30} alt="" style={{ borderRadius: 15, border: '2px solid #fff' }} />
            Who’s on my ballot?
          </div>
          <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.15, marginTop: 4 }}>{p.title}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '18px 48px 0' }}>
          {p.tiles.map(([party, name]) => (
            <div key={party} style={{ display: 'flex', alignItems: 'center', gap: 14, width: 357, height: tileH, padding: '12px 14px', border: `2px solid ${LINE}`, borderRadius: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG at build time */}
              <img src={logoPngDataUrl(party)} width={72} height={72} alt="" style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 3, background: '#fff' }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', fontSize: 24, fontWeight: 700 }}>{party}</div>
                <div style={{ display: 'flex', fontSize: nameSize, lineHeight: 1.2, marginTop: 2 }}>{name}</div>
              </div>
            </div>
          ))}
          {p.more > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 357, height: tileH, background: BAND, borderRadius: 16, color: DEEP }}>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>{`and ${p.more} more`}</div>
              <div style={{ display: 'flex', fontSize: 24 }}>{p.more === 1 ? 'candidate' : 'candidates'}</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', padding: '0 48px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: GREEN }}>{SITE_HOST}</div>
            <div style={{ display: 'flex', fontSize: 16, color: MUTED }}>{caption}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: MUTED }}>Not affiliated with INEC.</div>
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
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, color: INK, fontFamily: 'Geist' }}>
        <div style={{ display: 'flex', flexDirection: 'column', background: GREEN, color: '#fff', padding: '56px 72px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG at build time */}
            <img src={MARK} width={56} height={56} alt="" style={{ borderRadius: 28, border: '3px solid #fff' }} />
            Nigeria’s 2027 elections · 16 January and 6 February
          </div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, marginTop: 16, lineHeight: 1.1 }}>Who’s on my ballot?</div>
        </div>
        <div style={{ display: 'flex', fontSize: 40, lineHeight: 1.3, padding: '40px 72px 0' }}>
          Every candidate on your ballot, side by side, from INEC’s published lists.
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', padding: '0 72px 40px' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: GREEN }}>{SITE_HOST}</div>
          <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>Not affiliated with INEC.</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
