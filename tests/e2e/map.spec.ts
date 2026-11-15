import { expect, test } from '@playwright/test'

// The faint map of Nigeria (owner, 15 Nov 2026): it takes no space, so nothing moves and nothing scrolls sideways.
for (const width of [320, 360, 1280]) {
  for (const url of ['/', '/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/']) {
    test(`the map of Nigeria moves nothing and adds no sideways scroll: ${url} at ${width} px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 800 })
      await page.goto(url)
      const marks = page.locator('svg.ng-mark')
      await expect(marks).toHaveCount(url === '/' ? 2 : 1)
      for (const m of await marks.all()) await expect(m).toHaveAttribute('aria-hidden', 'true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const where = () => page.evaluate(() => [...document.querySelectorAll('main h1, main p, footer p')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(',') }))
      const withMark = await where()
      // the site's content security policy blocks injected style tags, so hide it through the element itself
      await page.evaluate(() => document.querySelectorAll<SVGElement>('.ng-mark').forEach((e) => { e.style.display = 'none' }))
      expect(await where()).toEqual(withMark)
      // inside the page's own width: never past the right edge
      await page.evaluate(() => document.querySelectorAll<SVGElement>('.ng-mark').forEach((e) => { e.style.display = '' }))
      for (const m of await marks.all()) {
        const b = (await m.boundingBox())!
        expect(b.x >= 0 && b.x + b.width <= width, JSON.stringify(b)).toBe(true)
      }
    })
  }
}

// The footer's map as a large backdrop (owner, 15 Nov 2026): the whole country, unstretched, as large as the footer's main
// part allows, never behind the credit line, edge to edge on a phone, at least 480 px wide on a 1440 px laptop; not printed.
for (const width of [320, 360, 768, 1024, 1440, 1920]) {
  test(`the footer map fills the footer's main part at ${width} px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/')
    const box = (s: string) => page.locator(s).evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height } })
    const [main, credit, svg, drawing] = await Promise.all([box('.footer-main'), box('.credit'), box('svg.ng-mark-foot'), box('svg.ng-mark-foot path')])
    // the drawing keeps Nigeria's shape (the fine outline's own 700 x 570 box) and sits inside the main part, above the credit
    expect(Math.abs(drawing.w / drawing.h - 700 / 570), JSON.stringify(drawing)).toBeLessThan(0.03)
    expect(drawing.y).toBeGreaterThanOrEqual(main.y - 1)
    expect(drawing.y + drawing.h).toBeLessThanOrEqual(Math.min(main.y + main.h, credit.y) + 1)
    if (width < 1024) expect(svg.x === 0 && Math.round(svg.w) === width, JSON.stringify(svg)).toBe(true) // edge to edge
    if (width >= 1440) expect(drawing.w).toBeGreaterThanOrEqual(480)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.locator('svg.ng-mark-foot')).toHaveAttribute('aria-hidden', 'true')
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('svg.ng-mark-foot')).toBeHidden()
  })
}

// Header on phones (owner, 15 Nov 2026): at least 8 px of clear space between the site name's text and the first button, with
// the name and the three buttons in one row. Measured with Liberation Sans (Arial's widths) and with a wider fallback font.
for (const width of [320, 360, 390, 412]) {
  for (const font of ['"Liberation Sans", Arial, sans-serif', '"DejaVu Sans", Verdana, sans-serif']) {
    test(`header at ${width} px (${font.split(',')[0]}): name clear of the buttons, one row`, async ({ browser }) => {
      const context = await browser.newContext({ bypassCSP: true, viewport: { width, height: 700 } })
      const page = await context.newPage()
      await page.goto('/about/')
      await page.addStyleTag({ content: `.site-header-in { font-family: ${font} !important }` })
      const m = await page.evaluate(() => {
        const name = document.querySelector('.site-name')!
        const range = document.createRange()
        range.selectNodeContents(name)
        const text = [...range.getClientRects()].filter(r => r.width > 0)
        const spans = [...document.querySelectorAll('.site-nav > span')].map(s => s.getBoundingClientRect())
        const head = document.querySelector('.site-header-in')!.getBoundingClientRect()
        return { textRight: Math.max(...text.map(r => r.right)), firstButton: spans[0].left, tops: spans.map(s => Math.round(s.top)), head: [head.top, head.bottom], textBottom: Math.max(...text.map(r => r.bottom)), sw: document.documentElement.scrollWidth }
      })
      expect(m.firstButton - m.textRight, JSON.stringify(m)).toBeGreaterThanOrEqual(8)
      expect(new Set(m.tops).size, JSON.stringify(m)).toBe(1) // one row of buttons
      expect(m.textBottom).toBeLessThanOrEqual(m.head[1]) // the name fits inside the header bar
      expect(m.sw).toBeLessThanOrEqual(width)
      await context.close()
    })
  }
}
