import { shareLinks } from '@/lib/site'

/** Plain share links plus a copy button that the page script reveals. The same block for every race and candidate. */
export function Share({ text, url, label }: { text: string, url: string, label: string }) {
  const l = shareLinks(text, url)
  return (
    <section className="share" aria-label={label}>
      <h2 className="share-title">{label}</h2>
      <ul className="link-list">
        <li><a href={l.whatsapp}>Share on WhatsApp</a></li>
        <li><a href={l.x}>Share on X</a></li>
        <li><button type="button" data-copy={url} hidden>Copy link</button></li>
      </ul>
    </section>
  )
}
