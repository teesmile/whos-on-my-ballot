import type { Page } from '@playwright/test'

/** Wait until the page's load animations (D-058) have finished, so checks see the final colours, not a mid-fade. Scroll-linked
 *  animations follow the scroll, not the clock, so they are not waited for. */
export async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every(a => a.timeline !== document.timeline || a.playState !== 'running'))
}
