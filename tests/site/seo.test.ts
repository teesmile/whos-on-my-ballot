/** Search and sharing checks over the built site (D-032): every address derives from SITE_URL. */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { BUILT_BY, SITE_URL } from '@/lib/site'

const OUT = path.resolve('out')

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

// every page except Next's 404 copies, as [path, html]
const pages: [string, string][] = [...walk(OUT)]
  .filter(f => f.endsWith('index.html'))
  .map(f => `/${path.relative(OUT, path.dirname(f)).split(path.sep).join('/')}/`.replace('//', '/'))
  .filter(p => p !== '/404/' && p !== '/_not-found/')
  .map(p => [p, fs.readFileSync(path.join(OUT, p, 'index.html'), 'utf8')])
const head = (h: string) => h.split('</head>')[0]
const meta = (h: string, attr: string, key: string) => new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(head(h))?.[1]
const unescape = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&#x27;', '\'').replaceAll('&quot;', '"')

describe('one address, canonical everywhere', () => {
  it('every page has exactly one canonical: the site address and its own path', () => {
    expect(pages.length).toBeGreaterThan(26_000)
    for (const [p, h] of pages) {
      const canon = [...head(h).matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(m => m[1])
      expect(canon, p).toEqual([`${SITE_URL}${p}`])
    }
  })

  it('no page names another address for the site', () => {
    for (const [p, h] of pages) expect(h.includes('ballot.anthonyugwuja.dev'), p).toBe(false)
  })

  it('the 404 page is not indexable and has no canonical', () => {
    const h = fs.readFileSync(path.join(OUT, '404.html'), 'utf8')
    expect(head(h)).toMatch(/<meta name="robots" content="noindex"/)
    expect(head(h)).not.toContain('rel="canonical"')
  })
})

describe('titles, descriptions and share tags', () => {
  it('every page: a unique title under 60 characters and a description under 155', () => {
    const seen = new Map<string, string>()
    const long: string[] = []
    for (const [p, h] of pages) {
      const title = unescape(/<title>([^<]*)<\/title>/.exec(head(h))![1])
      const description = unescape(meta(h, 'name', 'description') ?? '')
      if (title.length > 60) long.push(`${title.length} ${title}`)
      expect(seen.get(title), `${p} repeats the title of ${seen.get(title)}`).toBeUndefined()
      seen.set(title, p)
      expect(description.length, p).toBeGreaterThan(30)
      expect(description.length, `${p}: ${description}`).toBeLessThanOrEqual(155)
    }
    // Names are shown exactly as INEC prints them (the working rules §1), so a page titled by a long INEC name may pass 60
    // characters (candidates, ballots, wards and races). Hand-written, state and LGA titles never may, and a long ward title is
    // the ward's name alone.
    const fixed = long.filter(t => !/\([A-Z]{1,5}\), (?:President|Senate|House of Reps|Governor|State Assembly)(?:: .+)?$|^(?:16 Jan|6 Feb) ballot[:,] | ward(?:, [^:]+)?$|^(?:Senate|House of Reps|State Assembly): .+, [A-Z ]+$/.test(t.replace(/^\d+ /, '')))
    expect(fixed, fixed.slice(0, 5).join('\n')).toEqual([])
    for (const t of long.filter(x => / ward(?:, [^:]+)?$/.test(x))) expect(t, t).toMatch(/^\d+ [^,]+ ward$|^\d+ .+ ward$/) // the name alone
    for (const t of long) expect(t, t).not.toMatch(/ ward, .+: polling units$/)
    expect(long.length, long.slice(0, 5).join('\n')).toBeLessThan(pages.length * 0.02)
  })

  it('every page: Open Graph and X tags that match the page, with a described 1200x630 image on this site', () => {
    for (const [p, h] of pages) {
      const title = /<title>([^<]*)<\/title>/.exec(head(h))![1]
      expect(meta(h, 'property', 'og:title'), p).toBe(title)
      expect(meta(h, 'name', 'twitter:title'), p).toBe(title)
      expect(meta(h, 'property', 'og:description'), p).toBe(meta(h, 'name', 'description'))
      expect(meta(h, 'name', 'twitter:description'), p).toBe(meta(h, 'name', 'description'))
      expect(meta(h, 'property', 'og:url'), p).toBe(`${SITE_URL}${p}`)
      expect(meta(h, 'property', 'og:image'), p).toMatch(new RegExp(`^${SITE_URL.replaceAll('.', '\\.')}/cards/[a-z0-9-]+\\.png$`))
      expect(meta(h, 'property', 'og:image:width'), p).toBe('1200')
      expect(meta(h, 'property', 'og:image:alt')?.length, p).toBeGreaterThan(20)
      expect(meta(h, 'name', 'twitter:card'), p).toBe('summary_large_image')
    }
  })

  it('every share image a page names exists', () => {
    for (const [p, h] of pages.filter((_, i) => i % 25 === 0)) {
      const img = meta(h, 'property', 'og:image')!.slice(SITE_URL.length)
      expect(fs.existsSync(path.join(OUT, img)), `${p} ${img}`).toBe(true)
    }
  })
})

describe('sitemap and robots.txt', () => {
  const xml = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8')
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(m => [m[1], m[2]])

  it('lists every indexable page once, and nothing else', () => {
    const listed = entries.map(([u]) => u)
    expect(new Set(listed).size).toBe(listed.length)
    expect(new Set(listed)).toEqual(new Set(pages.map(([p]) => `${SITE_URL}${p}`)))
  })

  it('dates each page by its content, not by the build', () => {
    for (const [u, d] of entries) expect(d, u).toMatch(/^2026-\d{2}-\d{2}$/)
    const date = (p: string) => entries.find(([u]) => u === `${SITE_URL}${p}`)![1]
    expect(date('/c/jan-2027-house-fct-municipal-bwari-apc/')).toBe('2026-10-30') // INEC's PDF date
    expect(date('/c/feb-2027-sha-lagos-lagos-island-i-apc/')).toBe('2026-10-10')
    // a reader also sees the day a state's first group changed (D-070) and the day an approved photo appeared (D-071)
    expect(date('/c/jan-2027-house-abia-aba-north-aba-south-apc/')).toBe('2026-11-13')
    expect(date('/c/feb-2027-governor-kano-apc/')).toBe('2026-11-13')
    expect(date('/c/jan-2027-president-ndc/')).toBe('2026-11-11')
  })

  it('robots.txt allows the site, keeps the search data out and links the sitemap', () => {
    expect(fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8')).toBe(`User-Agent: *\nAllow: /\nDisallow: /data/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
  })
})

describe('structured data', () => {
  const graph = (h: string) => {
    const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]))
    expect(blocks.length).toBe(1)
    return blocks[0]['@graph'] as Record<string, unknown>[]
  }

  it('home defines the project and the site once; every other page refers to them by @id', () => {
    const home = graph(pages.find(([p]) => p === '/')![1])
    expect(home.map(x => x['@type'])).toEqual(['Organization', 'WebSite'])
    expect(home[0]['@id']).toBe(`${SITE_URL}/#organization`)
    expect(home[1]['@id']).toBe(`${SITE_URL}/#website`)
    for (const [p, h] of pages.filter(([p]) => p !== '/').filter((_, i) => i % 10 === 0)) {
      const [page, crumbs] = graph(h)
      expect(page['@type'], p).toBe('WebPage')
      expect(page.isPartOf, p).toEqual({ '@id': `${SITE_URL}/#website` })
      const items = crumbs.itemListElement as { item: string }[]
      expect(items[0].item, p).toBe(`${SITE_URL}/`)
      expect(items.at(-1)!.item, p).toBe(`${SITE_URL}${p}`)
    }
  })

  it('never describes a person, and links no profiles', () => {
    for (const [p, h] of pages) {
      const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h)![1]
      expect(block.includes('"Person"') || block.includes('sameAs'), p).toBe(false)
    }
  })
})

describe('icons and credit', () => {
  it('the full icon set from the one mark (D-047) exists and is linked, with the manifest', () => {
    for (const f of ['favicon.ico', 'icon.svg', 'apple-icon.png', 'icons/icon-32.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'manifest.webmanifest'])
      expect(fs.existsSync(path.join(OUT, f)), f).toBe(true)
    const h = head(pages[0][1])
    expect(h).toMatch(/<link rel="icon" href="\/favicon\.ico/)
    expect(h).toMatch(/<link rel="icon" href="\/icon\.svg/)
    expect(h).toMatch(/<link rel="apple-touch-icon" href="\/apple-icon\.png/)
    expect(h).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/)
    expect(h).toContain('<meta name="theme-color" content="#008751"/>')
    const svg = fs.readFileSync(path.join(OUT, 'icon.svg'), 'utf8')
    expect(svg).toContain('<circle cx="32" cy="32" r="32" fill="#008751"/>') // a true circle; the corners stay transparent
    const m = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.webmanifest'), 'utf8')) as { theme_color: string, icons: { src: string, purpose?: string }[] }
    expect(m.theme_color).toBe('#008751')
    expect(m.icons.filter(i => i.purpose === 'maskable').map(i => i.src)).toEqual(['/icons/maskable-512.png'])
    for (const i of m.icons) expect(fs.existsSync(path.join(OUT, i.src)), i.src).toBe(true)
  })

  it('every footer credits the builder, and nothing more', () => {
    for (const [p, h] of pages) {
      const footer = h.split('<footer')[1]
      // The owner's credit and heart (D-050): the heart is text, read as "love".
      expect(footer, p).toContain(`Built by <a href="${BUILT_BY.url}">${BUILT_BY.name}</a> with <span class="heart" role="img" aria-label="love">❤️</span>`)
      expect(footer, p).not.toMatch(/\bads\b/i)
    }
  })
})

describe('the owner\'s civic note (D-034)', () => {
  const NOTE = 'Whoever wins will serve four years. Don’t sell your vote. Vote your conscience. Vote for competence.'
  it('the about page carries the full citation: sections and retrieval date', () => {
    const about = pages.find(([p]) => p === '/about/')![1]
    expect(about).toMatch(/data-source="constitution-1999"><a href="[^"]+">Four-year terms \(the note on the home and election-day pages\): sections 64\(1\), 105\(1\), 135\(2\) and 180\(2\): Constitution of the Federal Republic of Nigeria 1999[^<]*, retrieved <time/)
  })

  it('appears, exactly and with its link, on the home and election-day pages only', () => {
    for (const [p, h] of pages) {
      const n = h.split('<footer')[0].split(NOTE).length - 1
      expect(n, p).toBe(p === '/' || p === '/election-day/' ? 1 : 0)
      if (n) expect(h, p).toMatch(/Vote for competence\. <a href="https:\/\/nigeriareposit\.nln\.gov\.ng\/[^"]+" target="_blank" rel="noopener noreferrer" data-source="constitution-1999">\(1999 Constitution\)<span class="visually-hidden"> \(opens in a new tab\)<\/span><\/a>/)
    }
  })
})

