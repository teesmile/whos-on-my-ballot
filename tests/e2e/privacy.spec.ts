import { expect, type Page, type Request, test } from '@playwright/test'

/** Record every request the page makes, so a test can prove what left the browser. */
function recordRequests(page: Page): Request[] {
  const seen: Request[] = []
  page.on('request', r => seen.push(r))
  return seen
}

async function storageIsEmpty(page: Page) {
  const stored = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }))
  expect(stored).toEqual({ local: 0, session: 0, cookie: '' })
}

function assertNothingLeaked(requests: Request[], typed: string[]) {
  for (const r of requests) {
    const url = new URL(r.url())
    expect(url.origin, r.url()).toBe('http://localhost:4322')
    expect(url.search, r.url()).toBe('')
    const body = r.postData() ?? ''
    for (const t of typed) {
      expect(r.url().toUpperCase()).not.toContain(t.toUpperCase())
      expect(body.toUpperCase()).not.toContain(t.toUpperCase())
    }
    expect(r.method()).toBe('GET')
  }
}

test('code lookup: what is typed never leaves the browser', async ({ page }) => {
  const requests = recordRequests(page)
  await page.goto('/')
  await page.getByLabel(/Delimitation code/).fill('01/01/01/001')
  await page.getByRole('button', { name: 'Find my polling unit' }).click()
  const result = page.getByRole('link', { name: /RAILWAY QUARTERS I/ })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page.getByText('Your polling unit: RAILWAY QUARTERS - RAILWAY QUARTERS I')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'President', level: 2 })).toBeVisible()
  assertNothingLeaked(requests, ['01/01/01/001', '01-01-01-001'])
  expect(requests.map(r => new URL(r.url()).pathname)).toContain('/data/pu/01.json')
  await storageIsEmpty(page)
})

test('unknown code says not found instead of guessing', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/Delimitation code/).fill('01/01/01/999')
  await page.getByRole('button', { name: 'Find my polling unit' }).click()
  await expect(page.getByText(/couldn’t find 01\/01\/01\/999/)).toBeVisible()
  await page.getByLabel(/Delimitation code/).fill('hello')
  await page.getByRole('button', { name: 'Find my polling unit' }).click()
  await expect(page.getByText(/isn’t a delimitation code/)).toBeVisible()
})

test('search: what is typed never leaves the browser', async ({ page }) => {
  const requests = recordRequests(page)
  await page.goto('/state/01/')
  await page.getByLabel('Your LGA', { exact: true }).selectOption({ label: 'ABA NORTH' })
  await page.getByLabel(/Polling unit name/).fill('eziama high shool')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('link', { name: /EZIAMA HIGH SCHOOL/ }).first()).toBeVisible()
  assertNothingLeaked(requests, ['eziama', 'shool'])
  await storageIsEmpty(page)
})

test('no third-party requests anywhere on the main path', async ({ page }) => {
  const requests = recordRequests(page)
  for (const p of ['/', '/state/24/', '/lga/24-01/', '/ward/24-01-01/', '/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/']) await page.goto(p)
  assertNothingLeaked(requests, [])
})
