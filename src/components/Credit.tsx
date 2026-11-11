import { BUILT_BY } from '@/lib/site'

/**
 * The owner's credit (D-032), with a red heart: the owner's decision and the one exception to the no-red rule (D-050).
 * The heart is text at the text's own size, on the same line, and reads as "love".
 */
export function Credit() {
  return (
    <p className="credit">
      Built by
      {' '}
      <a href={BUILT_BY.url}>{BUILT_BY.name}</a>
      {' with '}
      <span className="heart" role="img" aria-label="love">❤️</span>
    </p>
  )
}
