import { expect, test } from '@playwright/test'

test('a slow earlier lookup never overwrites a newer one', async ({ page }) => {
  let releaseAbia!: () => void
  const abiaHeld = new Promise<void>(r => (releaseAbia = r))
  await page.route('**/data/pu/01.json', async (route) => {
    await abiaHeld
    await route.continue()
  })
  await page.goto('/')
  const input = page.getByLabel(/Delimitation code/)
  const go = page.getByRole('button', { name: 'Find my polling unit' })
  await input.fill('01/01/01/001') // Abia: held back
  await go.click()
  await input.fill('02/01/01/001') // Adamawa: answers first
  await go.click()
  await expect(page.getByRole('status').getByRole('link')).toContainText('02/01/01/001')
  releaseAbia()
  await page.waitForResponse('**/data/pu/01.json')
  await page.waitForTimeout(300)
  await expect(page.getByRole('status').getByRole('link')).toContainText('02/01/01/001')
  await expect(page.getByRole('status')).not.toContainText('01/01/01/001')
})

test('a newer invalid code also wins over a slow earlier lookup', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>(r => (release = r))
  await page.route('**/data/pu/01.json', async (route) => {
    await held
    await route.continue()
  })
  await page.goto('/')
  const input = page.getByLabel(/Delimitation code/)
  const go = page.getByRole('button', { name: 'Find my polling unit' })
  await input.fill('01/01/01/001')
  await go.click()
  await input.fill('nonsense')
  await go.click()
  release()
  await page.waitForResponse('**/data/pu/01.json')
  await page.waitForTimeout(300)
  await expect(page.getByRole('status')).toContainText('isn’t a delimitation code')
})

for (const url of ['/', '/state/01/', '/ward/01-01-01/', '/ballot/adamawa/gombi-hong--adamawa-central-or-adamawa-north-or-adamawa-south/', '/c/jan-2027-president-ndc/', '/corrections/']) {
  test(`every visible link is at least 44 by 44 px at 360 px wide: ${url}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 })
    await page.goto(url)
    const small = await page.locator('a:visible').evaluateAll(links => links
      .filter(a => !a.classList.contains('skip'))
      .map((a) => {
        const r = a.getBoundingClientRect()
        return { text: (a.textContent ?? '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }
      })
      .filter(r => r.w < 44 || r.h < 44))
    expect(small).toEqual([])
  })
}
