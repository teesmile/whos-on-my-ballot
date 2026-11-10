import { expect, test } from '@playwright/test'

const CODE_LABEL = /Code on your voter’s card/

for (const typed of ['01-01-01-001', '01/01/01/001', '01 01 01 001', '01.01.01.001', '010101001', '1-1-1-1']) {
  test(`the code is found however it is typed: ${typed}`, async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(CODE_LABEL).fill(typed)
    await page.getByRole('button', { name: 'Find my polling unit' }).click()
    await expect(page.getByRole('status').getByRole('link', { name: /RAILWAY QUARTERS I/ })).toContainText('01-01-01-001')
  })
}

test('the home page explains the code in the card’s own dash format', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Like 24-15-03-012, with or without the dashes')).toBeVisible()
  await expect(page.getByLabel(CODE_LABEL)).toHaveAccessibleDescription('State, LGA and ward, then the last three digits for your polling unit.')
})

test('home: pick a state, then an LGA, then search by a landmark', async ({ page }) => {
  const urls: string[] = []
  page.on('request', r => urls.push(r.url()))
  await page.goto('/')
  const lga = page.getByLabel('Your LGA', { exact: true })
  await expect(lga).toBeDisabled()
  await page.getByLabel('Your state', { exact: true }).selectOption({ label: 'ABIA' })
  await expect(lga).toBeEnabled()
  await lga.selectOption({ label: 'ABA NORTH' })
  await page.getByLabel(/Landmark or polling unit name/).fill('eziama high shool')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('link', { name: /EZIAMA HIGH SCHOOL/ }).first()).toBeVisible()
  for (const u of urls) {
    expect(new URL(u).origin).toBe('http://localhost:4322')
    expect(u.toUpperCase()).not.toContain('EZIAMA')
  }
})

// The owner’s test of the protected preview failed here (D-040): a host that requires a login cookie redirected the data request, which
// was sent without cookies, to its login page. The data request must carry same-origin cookies when a host sets them.
test('the lookup works on a host that requires a login cookie for every file', async ({ page, context }) => {
  await context.addCookies([{ name: 'host_login', value: '1', domain: 'localhost', path: '/' }])
  await page.route('**/data/pu/**', async (route) => {
    const cookie = (await route.request().allHeaders()).cookie ?? ''
    if (cookie.includes('host_login=1')) await route.continue()
    else await route.fulfill({ status: 302, headers: { location: 'https://login.example/sso' } })
  })
  await page.goto('/')
  await page.getByLabel(CODE_LABEL).fill('01-01-01-001')
  await page.getByRole('button', { name: 'Find my polling unit' }).click()
  await expect(page.getByRole('status').getByRole('link', { name: /RAILWAY QUARTERS I/ })).toBeVisible()
})
