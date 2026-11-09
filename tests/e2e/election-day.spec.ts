import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// The same instants checked in three device time zones: the text must not change (Phase 4, Verified by).
const MOMENTS: [string, string, RegExp][] = [
  ['T-1 minute', '2027-01-16T07:29:00Z', /^Polls open in 1 minute\.$/],
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
        await expect(page.locator('.countdown .headline')).toHaveText(headline)
      })
    }
  })
}

test('after polls close, the results link goes to INEC’s IReV', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-16T15:00:00Z'))
  await page.goto('/election-day/')
  await expect(page.locator('.countdown').getByRole('link', { name: /IReV/ })).toHaveAttribute('href', 'https://inecelectionresults.ng/')
  await expect(page.locator('.countdown')).toContainText('Next: Saturday 6 February 2027')
})

test('the countdown moves on with the clock', async ({ page }) => {
  // Start 2½ minutes before opening, so time passing while the page loads can't change the expected text.
  await page.clock.install({ time: new Date('2027-01-16T07:27:30Z') })
  await page.goto('/election-day/')
  await expect(page.locator('.countdown .headline')).toHaveText('Polls open in 2 minutes.')
  await page.clock.runFor(180_000)
  await expect(page.locator('.countdown .headline')).toHaveText('Voting is underway.')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('the page is complete: dates, times, steps and INEC’s tools', async ({ page }) => {
    await page.goto('/election-day/')
    await expect(page.locator('.countdown')).toHaveText('Polls open Saturday 16 January 2027 at 8:30 AM WAT.')
    await expect(page.getByText('Saturday 6 February 2027', { exact: false }).first()).toBeVisible()
    await expect(page.locator('ol.steps li')).toHaveCount(8)
    await expect(page.getByRole('link', { name: /INEC Polling Unit Locator/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /IReV/ })).toBeVisible()
  })
})

test('axe finds no violations on the election-day page', async ({ page }) => {
  await page.goto('/election-day/')
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes.length} nodes`)).toEqual([])
})
