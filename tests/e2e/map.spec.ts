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
