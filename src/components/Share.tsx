import type { Picture } from '@/lib/share'
import { caption } from '@/lib/share'
import { shareLinks } from '@/lib/site'

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
      <p className="share-status" role="status" data-share-status />
    </section>
  )
}
