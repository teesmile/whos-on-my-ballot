import fs from 'node:fs'
import path from 'node:path'

import { ImageResponse } from 'next/og'

import { allRaces, generatedBytes, logoPngDataUrl, race, sharePhoto } from '@/lib/data'
import { picture } from '@/lib/share'
import { cardSourceCaption, SITE_HOST } from '@/lib/site'

// One share card per race, rendered at build time to /cards/<race-id>.png (1200x630, the Open Graph size).
// The same template for every race: white and the national green, the race's first group (D-042), then how many more
// candidates there are. Each tile is the share picture's (owner, 14 Nov 2026): the party's logo from INEC's register (D-043)
// over its acronym at the left, the candidate's approved photo at the right where the race's photo rule allows it (the
// same plain placeholder otherwise), and the name centred beneath. Both election dates and "Know every name on your
// ballot." on every card (owner, 14 Nov 2026), but never a countdown: apps keep a saved copy of a card for days, so a
// number of days would go stale.
const DATES = '16 January and 6 February 2027'
const KNOW = 'Know every name on your ballot.'
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
const TILE_LINE = '#bdbdbd'
const PHOTO_LINE = '#c4c4c4'
// The site's plain placeholder: a grey head-and-shoulders outline, the same drawing as the share picture's.
const PLACEHOLDER = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f4f4f4"/><circle cx="32" cy="25" r="11" fill="#cfcfcf"/><path d="M10 64C10 51 20 41 32 41S54 51 54 64Z" fill="#cfcfcf"/></svg>').toString('base64')}`
/** The photo the race's share picture uses (already through the photo rule), embedded; '' for none. */
const photoDataUrl = (slot: string) => (slot ? `data:image/${slot.endsWith('.png') ? 'png' : slot.endsWith('.webp') ? 'webp' : 'jpeg'};base64,${generatedBytes(slot.replace(/^\//, '')).toString('base64')}` : '')

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (file === 'site.png') return siteCard()
  const r = race(file.replace(/\.png$/, ''))
  const p = picture(r, sharePhoto)
  const n = p.tiles.length + (p.more ? 1 : 0)
  const titleSize = p.title.length > 70 ? 28 : p.title.length > 48 ? 34 : 42
  const longest = Math.max(...p.tiles.map(([, name]) => name.length))
  const nameSize = longest > 44 ? 17 : longest > 32 ? 19 : 22
  const rows = Math.ceil(n / 3)
  // A title on two lines takes a row's worth of room from the tiles, so the footer keeps its space.
  const tileH = rows === 1 ? 300 : p.title.length > 70 ? 174 : 186
  // Inside a tile, as in the share picture: the logo block and the photo the same height (h), the name's two lines beneath.
  const PAD = 12
  const innerW = 357 - 2 * PAD - 4
  const nameBlock = Math.ceil(2 * nameSize * 1.16)
  const h = Math.floor(Math.min((innerW - 24) / 2, tileH - 2 * PAD - 4 - nameBlock - 10))
  const acSize = 22
  // The "and N more" tile takes the rest of its row (owner, 14 Nov 2026), so a race with fewer than five in its first group
  // leaves no empty corner: two columns' width after four tiles, the full row after three.
  const TILE_W = 357
  const GAP = 14
  const restCols = 3 - (p.tiles.length % 3)
  const moreW = restCols * TILE_W + (restCols - 1) * GAP
  const caption = cardSourceCaption(r.sources)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, color: INK, fontFamily: 'Geist' }}>
        <div style={{ display: 'flex', flexDirection: 'column', background: GREEN, color: '#fff', padding: '20px 48px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG at build time */}
            <img src={MARK} width={30} height={30} alt="" style={{ borderRadius: 15, border: '2px solid #fff' }} />
            Who’s on my ballot?
            <div style={{ display: 'flex', marginLeft: 'auto', fontWeight: 700 }}>{DATES}</div>
          </div>
          <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.15, marginTop: 4 }}>{p.title}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP, padding: '18px 48px 0' }}>
          {p.tiles.map(([party, name, , slot]) => (
            <div key={party} style={{ display: 'flex', flexDirection: 'column', width: TILE_W, height: tileH, padding: PAD, border: `2px solid ${TILE_LINE}`, borderRadius: 16, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', height: h }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: h, height: h }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG at build time */}
                  <img src={logoPngDataUrl(party)} width={h - acSize - 6} height={h - acSize - 6} alt="" style={{ objectFit: 'contain' }} />
                  <div style={{ display: 'flex', fontSize: acSize, fontWeight: 700, lineHeight: 1, marginTop: 6 }}>{party}</div>
                </div>
                <div style={{ display: 'flex', width: h, height: h, borderRadius: 12, border: `2px solid ${PHOTO_LINE}`, overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG at build time */}
                  <img src={photoDataUrl(slot) || PLACEHOLDER} width={h - 4} height={h - 4} alt="" />
                </div>
              </div>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: nameSize, fontWeight: 700, lineHeight: 1.16 }}>{name}</div>
            </div>
          ))}
          {p.more > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: moreW, height: tileH, background: BAND, borderRadius: 16, color: DEEP }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: DEEP }}>{KNOW}</div>
            <div style={{ display: 'flex', fontSize: 18, color: MUTED }}>Not affiliated with INEC.</div>
          </div>
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
            {`Nigeria’s elections · ${DATES}`}
          </div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, marginTop: 16, lineHeight: 1.1 }}>Who’s on my ballot?</div>
        </div>
        <div style={{ display: 'flex', fontSize: 38, lineHeight: 1.3, padding: '36px 72px 0' }}>
          Every candidate on your ballot, side by side, from INEC’s published lists.
        </div>
        <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: DEEP, padding: '14px 72px 0' }}>{KNOW}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', padding: '0 72px 40px' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: GREEN }}>{SITE_HOST}</div>
          <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>Not affiliated with INEC.</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
