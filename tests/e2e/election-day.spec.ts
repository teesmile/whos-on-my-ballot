import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { settled } from './settled'

// The same instants checked in three device time zones: the text must not change (Phase 4, Verified by).
const MOMENTS: [string, string, RegExp | string][] = [
  ['T-1 minute', '2027-01-16T07:29:00Z', '00:00:01:00'],
  ['T (polls open)', '2027-01-16T07:30:00Z', /^Voting is underway\.$/],
  ['T+1 minute', '2027-01-16T07:31:00Z', /^Voting is underway\.$/],
  ['close (2:30 PM WAT)', '2027-01-16T13:30:00Z', /^Polls for Saturday 16 January 2027 closed to new arrivals at 2:30 PM WAT\.$/],
  ['after 6 February closes', '2027-02-06T13:30:00Z', /^Polls for Saturday 6 February 2027 closed to new arrivals at 2:30 PM WAT\.$/],
]

for (const timezoneId of ['UTC', 'Africa/Lagos', 'America/New_York']) {
  test.describe(`device time zone ${timezoneId}`, () => {
    test.use({ timezoneId })
    for (const [label, iso, headline] of MOMENTS) {
      test(label, async ({ page }) => {
        await page.clock.setFixedTime(new Date(iso))
        await page.goto('/election-day/')
        if (typeof headline === 'string') {
          await expect(page.locator('.clock .clock-n')).toHaveText(headline.split(':'))
          await expect(page.locator('.clock .clock-phase')).toBeHidden()
        }
        else {
          await expect(page.locator('.clock .headline')).toHaveText(headline)
        }
      })
    }
  })
}

test('after polls close, the results link goes to INEC’s IReV', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-16T15:00:00Z'))
  await page.goto('/election-day/')
  await expect(page.locator('.clock').getByRole('link', { name: /IReV/ })).toHaveAttribute('href', 'https://inecelectionresults.ng/')
  await expect(page.locator('.clock')).toContainText('Next: Saturday 6 February 2027')
})

test('the countdown moves on with the clock', async ({ page }) => {
  // Start 2½ minutes before opening, so time passing while the page loads can't change the expected text.
  await page.clock.install({ time: new Date('2027-01-16T07:27:29Z') })
  await page.goto('/election-day/')
  await page.clock.pauseAt(new Date('2027-01-16T07:27:30Z'))
  await expect(page.locator('.clock [data-unit="minutes"]')).toHaveText('02')
  await expect(page.locator('.clock [data-unit="seconds"]')).toHaveText('30')
  await page.clock.runFor(180_000)
  await expect(page.locator('.clock .headline')).toHaveText('Voting is underway.')
  await expect(page.locator('.clock-boxes')).toBeHidden()
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('the page is complete: dates, times, steps and INEC’s tools', async ({ page }) => {
    await page.goto('/election-day/')
    await expect(page.locator('.clock-static')).toHaveText('Polls open Saturday 16 January 2027 at 8:30 AM WAT.')
    await expect(page.getByText('Saturday 6 February 2027', { exact: false }).first()).toBeVisible()
    await expect(page.locator('ol.step-cards li')).toHaveCount(8)
    await expect(page.getByRole('link', { name: /INEC Polling Unit Locator/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /IReV/ })).toBeVisible()
  })
})

test('axe finds no violations on the election-day page', async ({ page }) => {
  await page.goto('/election-day/')
  await page.emulateMedia({ reducedMotion: 'reduce' }) // axe checks the final colours, not a fade part-way (D-058)
  await settled(page)
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes.length} nodes`)).toEqual([])
})

test('the IReV link keeps keyboard focus while the countdown updates (review 4)', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-01-16T15:00:00Z') })
  await page.goto('/election-day/')
  const link = page.locator('.clock').getByRole('link', { name: /IReV/ })
  await link.focus()
  await expect(link).toBeFocused()
  await page.clock.runFor(120_000) // four updates; the "next election" countdown text changes in between
  await expect(link).toBeFocused()
  await expect(page.locator('.clock')).toContainText('Polls open in')
})
