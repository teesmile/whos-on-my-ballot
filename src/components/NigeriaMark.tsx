/**
 * A faint outline of Nigeria (owner, 15 Nov 2026): a hint of which country the site is for, never an emblem. Not the flag and
 * not the coat of arms, so the site never looks official. Mainland border from Natural Earth's 1:50m countries (public
 * domain), drawn at Nigeria's middle latitude and simplified to 89 points; no state lines, which blur at this size.
 * Decorative: hidden from screen readers, drawn as a line only (no fill), so the page behind any text stays exactly as it was.
 */
const OUTLINE = 'M183 3l8 10l2 12l5 2l2 2l-1 11l-10 5l-5 6l-4 12l-3 2l-1 8l-4 2l-4 12l-5 2l-7 18l-4 5l2 3l-5 3l-1 4l-2 2l-5 2l-2 -5l-6 -6l-4 4l-3 -1l-1 -1l-6 4l-2 3l-10 9l-5 14l-4 8l-2 0l-3 -3l1 6l-11 1l-2 -3l-1 2l-3 0l-2 1l-4 2l-1 0l-4 1l-1 0l-5 0l-2 1l-9 -7l-4 -8l2 0l-2 -2l0 -2l-3 -3l4 -1l-2 -2l-3 2l-5 -7l-7 -5l-16 -1l-1 -2l-1 2l-11 0l1 -45l5 -1l5 -12l4 -3l0 -6l3 -2l1 -3l-2 -8l-4 -5l3 -6l0 -13l7 -7l1 -9l5 -3l14 -2l4 -2l14 4l10 11l15 -6l5 1l11 6l14 2l7 -7l7 -2l16 0l12 4l6 0l7 -6l7 -4z'

export function NigeriaMark({ className }: { className: string }) {
  return (
    <svg className={`ng-mark ${className}`} viewBox="-2 -2 204 167" aria-hidden="true" focusable="false">
      <path d={OUTLINE} />
    </svg>
  )
}
