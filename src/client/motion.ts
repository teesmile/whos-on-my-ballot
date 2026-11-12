/**
 * The scroll-in rise and fade (D-066), the same in every browser: each card, tile and panel still below the screen waits
 * invisible in its place, then rises 48px and fades in once, over 0.7 s, as it comes into view. A scroll-linked CSS version
 * would leave whatever sits at the screen's edge part-faded while the visitor is still, below AA contrast; this one always
 * finishes. Nothing happens under reduced motion or without IntersectionObserver; without this script everything is shown.
 * Only opacity and transform change, so nothing shifts the layout.
 */
export const REVEAL = '.card, .wa-tile, .panel, .results-panel, .link-list > li, .pu-list > li, .date-card, .step-card, .timeline > li, .race > h2, .race > h3, .results-strip, .share, .correct-row, .civic-note, .state-map, .results-table tbody tr, .sources > li, .about-page > :is(h2, p, ul)'

export function motion() {
  const root = document.documentElement
  if (root.classList.contains('rv-js') || !('IntersectionObserver' in window)) return
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return
  root.classList.add('rv-js')
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.remove('rv-wait')
      io.unobserve(e.target)
    }
  }) // any pixel on screen lets it go, so nothing wholly on screen is ever left waiting
  // Only what is still below the screen waits; what is already in view, or above it, is never hidden.
  for (const el of document.querySelectorAll<HTMLElement>(REVEAL)) {
    if (el.getBoundingClientRect().top < innerHeight) continue
    el.classList.add('rv', 'rv-wait')
    io.observe(el)
  }
  // A jump (a numbered source, a candidate) shows its target at once, in place, so it lands exactly below the sticky bars.
  const land = (hash = location.hash) => {
    const t = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    for (const el of document.querySelectorAll<HTMLElement>('.rv-wait')) {
      if (t && (el === t || el.contains(t))) {
        el.classList.remove('rv', 'rv-wait')
        io.unobserve(el)
      }
    }
  }
  land()
  addEventListener('hashchange', () => land())
  // before the browser scrolls to the target, not after
  addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
    if (a) land(a.getAttribute('href')!)
  }, true)
}

/**
 * Tapping a tile (state, LGA, ward, polling unit) or an outlined button fills it solid green at once (owner feedback, 11 Nov
 * 2026); the stylesheet does it while the finger is down (:active), and this keeps it filled until the next page opens.
 */
export const TAP = '.link-list a, .pu-list a, .result a:not(.btn), button.btn-share, button.btn-quiet, .race-tabs a'

export function tapFeedback() {
  const root = document.documentElement
  if (root.dataset.tap) return
  root.dataset.tap = '1'
  // Safari applies :active on touch only when the page listens for touches
  addEventListener('touchstart', () => {}, { passive: true })
  addEventListener('click', (e) => {
    const t = (e.target as Element | null)?.closest?.(TAP)
    if (!t) return
    for (const o of document.querySelectorAll('.tapped')) o.classList.remove('tapped')
    t.classList.add('tapped')
    // an in-page action (a tab, Share, Copy link) lets go once it has shown
    if (!(t instanceof HTMLAnchorElement) || t.getAttribute('href')?.startsWith('#')) setTimeout(() => t.classList.remove('tapped'), 250)
  }, true)
  // coming back with the browser's Back button shows the page as it was left: let go of the fill
  addEventListener('pageshow', () => { for (const o of document.querySelectorAll('.tapped')) o.classList.remove('tapped') })
}
