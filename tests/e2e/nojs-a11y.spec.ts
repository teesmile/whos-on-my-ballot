import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const PAGES = [
  '/',
  '/state/24/',
  '/lga/24-15/',
  '/ward/24-15-03/',
  '/ballot/abia/aba-north-aba-south--abia-south/#pu-01-01-01-001',
  '/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/',
  '/ballot/adamawa/gombi-hong--adamawa-central-or-adamawa-north-or-adamawa-south/',
  '/c/jan-2027-president-ndc/',
  '/c/jan-2027-president-a/',
  '/c/jan-2027-house-lagos-eti-osa-ndc/',
  '/corrections/',
]

for (const url of PAGES) {
  test(`axe finds no violations: ${url}`, async ({ page }) => {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(violations.map(v => `${v.id}: ${v.nodes.length} nodes`)).toEqual([])
  })
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('state → LGA → ward → polling unit → ballot works with plain links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Find my polling unit' })).toBeHidden()
    await page.getByRole('link', { name: 'LAGOS', exact: true }).click()
    await page.getByRole('link', { name: 'SURULERE', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Choose your ward' })).toBeVisible()
    await page.locator('main ul.link-list li a').first().click()
    await expect(page.getByRole('heading', { name: 'Is this your polling unit?' })).toBeVisible()
    await page.locator('main ul.pu-list li a').first().click()
    await expect(page.getByRole('heading', { name: 'Your ballot for 16 January 2027' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'President', level: 2 })).toBeVisible()
    await expect(page.getByText('one of these is on your ballot').first()).toBeVisible()
  })
})

test('keyboard: the code lookup works with the keyboard alone', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab') // skip link
  await page.keyboard.press('Tab') // site name
  await page.keyboard.press('Tab') // "Election day" in the header
  await page.keyboard.press('Tab') // code input
  await expect(page.getByLabel(/Delimitation code/)).toBeFocused()
  await page.keyboard.type('01/01/01/001')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Is this your polling unit?' })).toBeVisible()
  await page.keyboard.press('Tab') // submit button
  await page.keyboard.press('Tab') // the result
  await expect(page.getByRole('link', { name: /RAILWAY QUARTERS I/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/ballot\/abia\/.+#pu-01-01-01-001$/)
})

test('copy link button copies the page link, and is hidden without JavaScript', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/c/jan-2027-president-apc/')
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://ballot.anthonyugwuja.dev/c/jan-2027-president-apc/')
})

test.describe('candidate page without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('shows everything except the copy button', async ({ page }) => {
    await page.goto('/c/jan-2027-president-apc/')
    await expect(page.getByRole('heading', { name: 'Background' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Email a correction' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeHidden()
  })
})
