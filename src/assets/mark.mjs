// The site's mark (owner's pick, D-047): a white ballot paper with a thumbprint, on a national-green circle.
// Drawn on a 64-unit grid. MARK is the paper and thumbprint alone, so the same drawing can sit on a circle or a full square.
export const GREEN = '#008751'
export const MARK = `<rect x="14" y="11" width="27" height="35" rx="3.5" fill="#fff"/><path d="M19.5 20h16M19.5 27.5h11" stroke="${GREEN}" stroke-width="3.4" stroke-linecap="round"/><g transform="rotate(-12 41 42)"><ellipse cx="41" cy="42" rx="11.5" ry="14" fill="#fff" stroke="${GREEN}" stroke-width="2.6"/><path d="M40.32 45.85A2.2 3 0 1 1 42.47 45.23M39.21 50.04A5.8 7.4 0 1 1 44.57 48.83M38.1 54.22A9.4 11.8 0 1 1 46.26 52.78" fill="none" stroke="${GREEN}" stroke-width="2.3" stroke-linecap="round"/></g>`
/** The icon: a true circle with transparent corners. */
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${GREEN}"/>${MARK}</svg>`
/** Full-bleed square (iPhone home screen, which allows no transparency), the mark at `scale` around the centre. */
export const squareSvg = scale => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${GREEN}"/><g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${MARK}</g></svg>`
