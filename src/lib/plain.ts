/**
 * Plain hyphens only in what the site shows (owner rule). INEC's files and quoted sources sometimes use the en dash
 * (U+2013) or em dash (U+2014); data/generated keeps their text as printed, and every read for display turns each into
 * a hyphen, keeping the spacing around it. scripts/no-long-dash.mjs fails the build if either reaches the output.
 */
export const LONG_DASH = /[\u2013\u2014]/g
export const plainDashes = (s: string): string => s.replace(LONG_DASH, '-')
