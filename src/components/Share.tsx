import type { Picture } from '@/lib/share'
import { shareLinks } from '@/lib/site'

/**
 * The same share block for every race and candidate. Without JavaScript, "Share on WhatsApp" is a plain link that opens
 * WhatsApp with the caption and the address (which shows the link-preview card). The page script adds the phone's own
 * share menu and "Copy link", and, where the phone can share files, sends a picture of the race drawn in the browser.
 * The address is always the race's or candidate's page: never the visitor's polling unit or anything they typed.
 */
export function Share({ text, url, label, picture, level = 2 }: { text: string, url: string, label: string, picture: Picture, level?: 2 | 3 | 4 }) {
  const l = shareLinks(text, url)
  const H = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <section className="share" aria-label={label} data-share={JSON.stringify({ text, url, ...picture })}>
      <H className="share-title">{label}</H>
      <div className="share-buttons">
        <a className="btn btn-wa" href={l.whatsapp} data-share-wa>Share on WhatsApp</a>
        <button type="button" className="btn btn-share" data-share-sheet hidden>Share</button>
        <button type="button" className="btn-quiet" data-copy={url} hidden>Copy link</button>
      </div>
    </section>
  )
}
