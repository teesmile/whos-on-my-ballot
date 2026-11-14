import type { Picture } from '@/lib/share'
import { caption } from '@/lib/share'
import { appLinks, appMessage, racePath, shareLinks, SITE_URL } from '@/lib/site'

/** WhatsApp's official glyph, unaltered (src/assets/brand/whatsapp): white on green, or green on white. Decorative. */
export function WhatsAppGlyph({ on = 'green' }: { on?: 'green' | 'white' }) {
  return <span className={on === 'white' ? 'wa-glyph wa-glyph-green' : 'wa-glyph'} aria-hidden="true" />
}

/**
 * The same share block for every race and candidate. Without JavaScript, "Share on WhatsApp" is a plain link that opens
 * WhatsApp with the caption and the address (which shows the link-preview card). The page script adds the phone's own
 * share menu and "Copy link", and, where the phone can share files, sends a picture of the race drawn in the browser.
 * A race shares the home page, so whoever opens it picks their own place (owner decision, 11 Nov 2026); a candidate page
 * shares itself. "Copy link" copies the page's own address. Never the visitor's polling unit or anything they typed.
 *
 * Under it, "Share on" and four icons (owner, 14 Nov 2026), each the app's official glyph in its own brand colour, the same
 * size, with no box: WhatsApp, X and Facebook are plain links into each app's own share page with the same short message and
 * the race's own page (never the ballot, which would carry the visitor's place); Instagram takes no links from websites, so
 * the page script shares the race's picture (a phone's share menu) or saves it (a computer). No script from any of them.
 */
export function Share({ url, copyUrl = url, label, picture, level = 2 }: { url: string, copyUrl?: string, label: string, picture: Picture, level?: 2 | 3 | 4 }) {
  const text = caption()
  const l = shareLinks(text, url)
  const H = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <section className="share" aria-label={label} data-share={JSON.stringify({ text, url, ...picture })}>
      <H className="share-title">{label}</H>
      <div className="share-buttons">
        <a className="btn btn-wa" href={l.whatsapp} data-share-wa>
          <WhatsAppGlyph />
          Share on WhatsApp
        </a>
        <button type="button" className="btn btn-share" data-share-sheet hidden>Share</button>
        <button type="button" className="btn-quiet" data-copy={copyUrl} hidden>Copy link</button>
      </div>
      <AppRow picture={picture} />
      <p className="share-status" role="status" data-share-status />
    </section>
  )
}

/** "Share on" and the four apps. The words are for sighted readers; each icon carries its own full name for screen readers. */
function AppRow({ picture }: { picture: Picture }) {
  const url = `${SITE_URL}${racePath(picture.race)}`
  const l = appLinks(appMessage(picture.name, picture.date), url)
  return (
    <div className="share-on">
      <span className="share-on-label" aria-hidden="true">Share on</span>
      <a className="share-app" href={l.whatsapp} aria-label="Share on WhatsApp" data-app="whatsapp">
        <span className="wa-glyph glyph-icon glyph-whatsapp" aria-hidden="true" />
      </a>
      <a className="share-app" href={l.x} target="_blank" rel="noopener" aria-label="Share on X" data-app="x">
        <span className="glyph-icon glyph-x" aria-hidden="true" />
      </a>
      <a className="share-app" href={l.facebook} target="_blank" rel="noopener" aria-label="Share on Facebook" data-app="facebook">
        <span className="glyph-icon glyph-facebook" aria-hidden="true" />
      </a>
      <button type="button" className="share-app" aria-label="Share on Instagram" data-app="instagram" data-share-ig hidden>
        <span className="glyph-icon glyph-instagram" aria-hidden="true" />
      </button>
    </div>
  )
}
