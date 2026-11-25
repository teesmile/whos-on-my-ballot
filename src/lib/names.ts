/**
 * Place names as the site shows them (owner, 25 Nov 2026, D-100): states, LGAs, senatorial districts and federal and
 * state constituencies in title case, INEC's uneven spacing inside a name closed up. Ward and polling-unit names stay
 * exactly as INEC prints them ("PRY SCH", "L.G.E.A", "HQTRS" would not survive title case), and candidate names always do
 * (hard rule 1). The data keeps INEC's text; src/lib/data.ts applies this once, when it loads the files.
 */
const ROMAN = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/
const KEEP = new Set(['FCT', 'LGA', 'AMAC'])
const SMALL = new Set(['and', 'of', 'the'])

/** 'SAKI EAST AND ATISBO' -> 'Saki East and Atisbo', 'IKOLE I' -> 'Ikole I', 'AKWA IBOM' -> 'Akwa Ibom'. Text INEC
 *  already prints in mixed case is left as it is. */
export function placeCase(s: string): string {
  if (!s || s !== s.toUpperCase()) return s
  let first = true
  return s.replace(/[A-Za-z][A-Za-z']*/g, w => {
    const lower = w.toLowerCase()
    const out = ROMAN.test(w) || KEEP.has(w) ? w
      : !first && SMALL.has(lower) ? lower
        : /^o'[a-z]/.test(lower) ? `O'${lower[2].toUpperCase()}${lower.slice(3)}`
          : lower[0].toUpperCase() + lower.slice(1)
    first = false
    return out
  })
}

/** placeCase, then INEC's uneven spacing closed up: 'North /South' -> 'North/South', 'SOUTH - WEST' -> 'South-West',
 *  'IKPOBA - OKHA' -> 'Ikpoba-Okha' (a hyphen inside a name, not between phrases), 'KAIAMA  II' -> 'Kaiama II'. */
export const placeName = (s: string): string => placeCase(s).replace(/\s*([/-])\s*/g, '$1').replace(/\s{2,}/g, ' ').trim()
