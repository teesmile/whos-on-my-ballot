/**
 * A faint outline of Nigeria (owner, 15 Nov 2026): a hint of which country the site is for, never an emblem. Not the flag and
 * not the coat of arms, so the site never looks official. Mainland border from Natural Earth's 1:50m countries (public
 * domain), drawn at Nigeria's middle latitude: 89 points for the home page's small mark, and 208 points on a 700-unit grid
 * for the footer's large backdrop (owner, 15 Nov 2026), so it stays smooth at 700 px wide. No state lines, which blur.
 * Decorative: hidden from screen readers, drawn as a line only (no fill), so the page behind any text stays exactly as it was.
 */
const OUTLINE = 'M183 3l8 10l2 12l5 2l2 2l-1 11l-10 5l-5 6l-4 12l-3 2l-1 8l-4 2l-4 12l-5 2l-7 18l-4 5l2 3l-5 3l-1 4l-2 2l-5 2l-2 -5l-6 -6l-4 4l-3 -1l-1 -1l-6 4l-2 3l-10 9l-5 14l-4 8l-2 0l-3 -3l1 6l-11 1l-2 -3l-1 2l-3 0l-2 1l-4 2l-1 0l-4 1l-1 0l-5 0l-2 1l-9 -7l-4 -8l2 0l-2 -2l0 -2l-3 -3l4 -1l-2 -2l-3 2l-5 -7l-7 -5l-16 -1l-1 -2l-1 2l-11 0l1 -45l5 -1l5 -12l4 -3l0 -6l3 -2l1 -3l-2 -8l-4 -5l3 -6l0 -13l7 -7l1 -9l5 -3l14 -2l4 -2l14 4l10 11l15 -6l5 1l11 6l14 2l7 -7l7 -2l16 0l12 4l6 0l7 -6l7 -4z'

const FINE = 'M640 10l27 37l8 41l13 3l6 2l6 9l-2 19l-2 6l1 12l-1 2l-4 3l-17 11l-8 1l-5 2l-5 4l-11 16l-10 16l-7 26l-9 8l-4 28l-10 4l-6 4l-3 7l-4 25l-4 8l-9 8l-10 1l-10 19l-5 20l-8 13l0 8l-15 19l6 9l-17 14l-1 11l-9 10l-10 5l-5 0l-2 -1l-6 -17l-16 -14l-8 -5l-3 2l-2 6l-2 2l-4 1l-12 -1l-4 -6l-16 12l-5 2l-7 14l-17 12l-18 19l-8 13l-8 35l-14 26l-2 2l-5 -1l-2 -4l-3 -1l-6 -6l-1 1l6 15l-2 6l-38 2l-5 -2l-3 -2l-3 2l-10 0l-7 -4l-1 6l-8 7l-6 1l-3 -3l-2 -12l-3 -5l-1 0l2 15l4 6l-6 2l-8 0l-4 0l-17 2l0 -8l-3 3l-1 6l-2 1l-5 -1l-6 -3l-11 -7l-12 -11l-12 -29l1 -1l3 1l2 -2l-6 -1l-1 -5l0 -4l1 -4l-9 -5l-2 -3l1 -2l11 0l-3 -3l-1 -2l-3 1l-6 2l-4 -2l-1 -8l-3 -2l-10 -13l-14 -12l-12 -7l-18 -4l-37 0l-2 -1l17 -9l-2 -1l-16 4l-6 8l-37 1l2 -13l2 -7l-2 -8l-1 -8l2 -5l0 -20l2 -4l-4 -9l-1 -12l-1 -3l3 -54l2 -16l16 -2l4 -6l2 -8l-1 -8l12 -12l-1 -7l2 -2l7 -2l5 -4l3 -5l2 -10l-4 -6l2 -5l4 -5l5 1l1 -1l3 -10l0 -3l-4 -7l-3 -18l-13 -19l0 -6l4 -8l6 -8l-2 -4l-1 -3l2 -5l0 -33l18 -15l5 -9l3 -7l4 -24l5 -3l11 -9l14 -5l9 -1l17 1l8 -1l7 -5l7 -2l41 12l7 1l5 3l12 12l12 17l8 6l7 1l7 -5l6 -2l5 0l25 -13l3 0l15 3l21 13l18 9l26 5l24 1l19 -19l6 -4l9 -4l17 -4l28 -2l27 1l16 3l17 6l8 6l12 1l8 -1l3 -6l8 -8l13 -7l10 -5l9 -2l8 -6l6 -2z'

export function NigeriaMark({ className, large = false }: { className: string, large?: boolean }) {
  return (
    <svg className={`ng-mark ${className}`} viewBox={large ? '-7 -7 714 584' : '-2 -2 204 167'} aria-hidden="true" focusable="false">
      <path d={large ? FINE : OUTLINE} />
    </svg>
  )
}
