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
    // the drawing keeps Nigeria's shape (the outline's own 200 x 163 box) and sits inside the main part, above the credit
    expect(Math.abs(drawing.w / drawing.h - 200 / 163), JSON.stringify(drawing)).toBeLessThan(0.03)
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
