import { expect, test } from '@playwright/test'

const JAN_ABA = '/ballot/abia/aba-north-aba-south--abia-south/'
const FEB_ABA = '/ballot-feb/abia/aba-north/'

test('code lookup offers both election days, and each ballot links to the other for the same polling unit', async ({ page }) => {
  const requests: string[] = []
  page.on('request', r => requests.push(r.url()))
  await page.goto('/')
  await page.getByLabel(/Delimitation code/).fill('01/01/01/001')
  await page.getByRole('button', { name: 'Find my polling unit' }).click()
  await expect(page.getByRole('link', { name: /RAILWAY QUARTERS I/ })).toHaveAttribute('href', `${JAN_ABA}#pu-01-01-01-001`)
  const feb = page.getByRole('link', { name: '6 February 2027 ballot' })
  await expect(feb).toHaveAttribute('href', `${FEB_ABA}#pu-01-01-01-001`)
  await feb.click()
  await expect(page.getByRole('heading', { name: 'Your ballot for 6 February 2027' })).toBeVisible()
  await expect(page.getByText('Your polling unit: RAILWAY QUARTERS - RAILWAY QUARTERS I')).toBeVisible()
  await expect(page.getByText('belongs to a different ballot')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Governor: ABIA', level: 2 })).toBeVisible()
  await page.getByRole('link', { name: 'Your ballot for 16 January 2027' }).click()
  await expect(page).toHaveURL(new RegExp(`${JAN_ABA}#pu-01-01-01-001$`))
  await expect(page.getByRole('link', { name: 'Your ballot for 6 February 2027' })).toHaveAttribute('href', `${FEB_ABA}#pu-01-01-01-001`)
  for (const u of requests) {
    expect(new URL(u).origin).toBe('http://localhost:4322')
    expect(u).not.toContain('01/01/01/001')
  }
})

test('a 6 February ballot opened with another ward’s polling unit says so and links the right one', async ({ page }) => {
  await page.goto('/ballot-feb/lagos/surulere-ii/#pu-01-01-01-001')
  await expect(page.getByText('This polling unit belongs to a different ballot.')).toHaveCount(0) // a different state: ignored
  await page.goto('/ballot-feb/abia/aba-central/#pu-01-01-01-001')
  await expect(page.getByText('This polling unit belongs to a different ballot.')).toBeVisible()
  await expect(page.getByRole('link', { name: '6 February 2027 ballot' })).toHaveAttribute('href', `${FEB_ABA}#pu-01-01-01-001`)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('ward page → 6 February ballot works with a plain link', async ({ page }) => {
    await page.goto('/ward/24-20-01/')
    await page.getByRole('link', { name: 'Your ballot for 6 February 2027, ORILE ward' }).click()
    await expect(page.getByRole('heading', { name: 'Your ballot for 6 February 2027' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Governor: LAGOS', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'State House of Assembly: SURULERE II', level: 2 })).toBeVisible()
  })

  test('an off-cycle state says there is no governorship election', async ({ page }) => {
    await page.goto('/ballot-feb/osun/ayedade/')
    await expect(page.getByText('No governorship election in OSUN on 6 February 2027.')).toBeVisible()
  })
})
