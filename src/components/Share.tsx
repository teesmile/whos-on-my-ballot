import type { Picture } from '@/lib/share'
import { caption } from '@/lib/share'
import { shareLinks } from '@/lib/site'

/**
 * Beside "Share on WhatsApp". WhatsApp's own logo may only be used as its brand files supply it (the owner downloads
 * them under WhatsApp's terms); until then this is a plain, neutral share sign, never a look-alike of WhatsApp's mark.
 */
export function WhatsAppMark() {
  return (
    <svg className="share-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The same share block for every race and candidate. Without JavaScript, "Share on WhatsApp" is a plain link that opens
 * WhatsApp with the caption and the address (which shows the link-preview card). The page script adds the phone's own
 * share menu and "Copy link", and, where the phone can share files, sends a picture of the race drawn in the browser.
 * The address is always the race's or candidate's page: never the visitor's polling unit or anything they typed.
 */
export function Share({ url, label, picture, level = 2 }: { url: string, label: string, picture: Picture, level?: 2 | 3 | 4 }) {
  const text = caption()
  const l = shareLinks(text, url)
  const H = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <section className="share" aria-label={label} data-share={JSON.stringify({ text, url, ...picture })}>
      <H className="share-title">{label}</H>
      <div className="share-buttons">
        <a className="btn btn-wa" href={l.whatsapp} data-share-wa>
          <WhatsAppMark />
          Share on WhatsApp
        </a>
        <button type="button" className="btn btn-share" data-share-sheet hidden>Share</button>
        <button type="button" className="btn-quiet" data-copy={url} hidden>Copy link</button>
      </div>
      <p className="share-status" role="status" data-share-status />
    </section>
  )
}
