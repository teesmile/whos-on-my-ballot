import fs from 'node:fs'

import { expect, type Page, test } from '@playwright/test'
import { PNG } from 'pngjs'

const ABA = '/ballot/abia/aba-north-aba-south--abia-south/'
const SURULERE = '/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/'

test.describe('race tabs (D-045)', () => {
  test('one race at a time; the active tab is marked; the address keeps the choice', async ({ page }) => {
    await page.goto(ABA)
    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(3)
    const pres = page.getByRole('tab', { name: /President/ })
    await expect(pres).toHaveAttribute('aria-selected', 'true')
    await expect(pres).toHaveAccessibleName(/President \d+ candidates/)
    await expect(page.getByRole('heading', { name: 'President', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Senate:/, level: 2 })).toBeHidden()
    await page.getByRole('tab', { name: /Senate/ }).click()
    await expect(page.getByRole('heading', { name: /^Senate:/, level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'President', level: 2 })).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`${ABA}#senate$`))
    // a shared link opens on the same tab
    await page.goto(`${ABA}#house`)
    await expect(page.getByRole('tab', { name: /House of Reps/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: /^House of Representatives:/, level: 2 })).toBeVisible()
  })

  test('keyboard: arrows, Home and End move between tabs and show each race', async ({ page }) => {
    await page.goto(ABA)
    await page.getByRole('tab', { name: /President/ }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /Senate/ })).toBeFocused()
    await expect(page.getByRole('tab', { name: /Senate/ })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    await expect(page.getByRole('tab', { name: /House of Reps/ })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /President/ })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('tab', { name: /House of Reps/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toHaveCount(1)
  })

  test('“Next” buttons lead through every race, and the polling unit stays in the address', async ({ page }) => {
    await page.goto(`${ABA}#pu-01-01-01-001`)
    await expect(page.getByText('Your polling unit: RAILWAY QUARTERS - RAILWAY QUARTERS I')).toBeVisible()
    await page.getByRole('link', { name: 'Next: Senate' }).click()
    await expect(page.getByRole('tab', { name: /Senate/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/#pu-01-01-01-001&senate$/)
    await page.getByRole('link', { name: 'Next: House of Representatives' }).click()
    await expect(page.getByRole('tab', { name: /House of Reps/ })).toBeFocused()
    await expect(page.getByRole('link', { name: /^Next:/ })).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Your polling unit: RAILWAY QUARTERS - RAILWAY QUARTERS I')).toBeVisible()
    await expect(page.getByRole('tab', { name: /House of Reps/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('the tab bar stays stuck under the header while scrolling on a phone', async ({ page }) => {
    await page.goto(ABA)
    await page.mouse.wheel(0, 2500)
    await page.waitForTimeout(200)
    const box = await page.locator('nav.race-tabs').boundingBox()
    const header = await page.locator('.site-header').boundingBox()
    expect(Math.abs(box!.y - header!.height)).toBeLessThanOrEqual(1)
    await expect(page.getByRole('tab', { name: /Senate/ })).toBeInViewport()
  })

  test('a candidate page’s breadcrumb opens the right race tab', async ({ page }) => {
    await page.goto('/c/jan-2027-house-abia-aba-north-aba-south-apc/')
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: /House of Representatives/ }).click()
    await expect(page.getByRole('tab', { name: /House of Reps/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('6 February: Governor and State Assembly tabs', async ({ page }) => {
    await page.goto('/ballot-feb/lagos/surulere-ii/')
    await expect(page.getByRole('tab')).toHaveText([/Governor/, /State Assembly/])
    await page.getByRole('link', { name: 'Next: State House of Assembly' }).click()
    await expect(page.getByRole('heading', { name: 'State House of Assembly: SURULERE II', level: 2 })).toBeVisible()
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('the races show one after another, with links to each and no filter', async ({ page }) => {
    await page.goto(SURULERE)
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'President', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Senate: LAGOS CENTRAL', level: 2 })).toBeVisible()
    await expect(page.getByText('one of these is on your ballot').first()).toBeVisible()
    await expect(page.getByLabel(/Find a party or candidate/).first()).toBeHidden()
    await expect(page.getByRole('link', { name: 'Share on WhatsApp' }).first()).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0)
  })
})

test.describe('the grid', () => {
  test('two cards per row on a phone, names whole, the first group labelled, no sideways scroll', async ({ page }) => {
    await page.goto(ABA)
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByRole('heading', { name: 'Five parties with the most candidates in 2027' })).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'All other parties, in ballot order' })).toBeVisible()
    const cards = panel.locator('.cards').first().locator('.card')
    const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()]
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(1)
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // no name is clipped
    const clipped = await page.locator('.card-name, .card-mate').evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).length)
    expect(clipped).toBe(0)
  })

  test('the ticket with no named candidate keeps its place as a muted card', async ({ page }) => {
    await page.goto(ABA)
    const card = page.locator('.card.muted')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('No candidate named - INEC remark: COURT ORDER')
  })

  test('the filter narrows the race as the visitor types, and sends nothing', async ({ page }) => {
    const urls: string[] = []
    page.on('request', r => urls.push(r.url()))
    await page.goto(ABA)
    const filter = page.getByRole('tabpanel').getByLabel('Find a party or candidate in this race')
    await filter.fill('tinubu')
    await expect(page.getByRole('tabpanel').locator('.card:visible')).toHaveCount(1)
    await expect(page.getByRole('tabpanel').locator('.card:visible')).toHaveAttribute('data-party', 'APC')
    await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'All other parties, in ballot order' })).toBeHidden()
    await filter.fill('zzzz')
    await expect(page.getByRole('tabpanel').getByText('No party or candidate in this race matches.')).toBeVisible()
    await filter.fill('')
    await expect(page.getByRole('tabpanel').locator('.card:visible')).toHaveCount(19)
    for (const u of urls) {
      expect(u).not.toContain('tinubu')
      expect(u).not.toContain('zzzz')
    }
  })

  test('a card opens the candidate’s full details', async ({ page }) => {
    await page.goto(ABA)
    await page.getByRole('tabpanel').locator('.card').first().click()
    await expect(page).toHaveURL(/\/c\/jan-2027-president-adc\/$/)
    await expect(page.getByRole('heading', { name: 'From INEC’s list' })).toBeVisible()
    await expect(page.locator('.party-head svg.logo')).toHaveAttribute('aria-label', 'ADC')
  })
})

/** Stand in for an Android phone's share menu: record what the page hands to it. */
async function fakeShareSheet(page: Page, files: boolean) {
  await page.addInitScript((files) => {
    const w = window as unknown as { shared: unknown[] }
    w.shared = []
    Object.defineProperty(navigator, 'canShare', { value: (d: { files?: File[] }) => files || !d.files })
    Object.defineProperty(navigator, 'share', {
      value: async (d: { files?: File[], text?: string, url?: string }) => {
        const file = d.files?.[0]
        w.shared.push({ text: d.text, url: d.url, name: file?.name, type: file?.type, bytes: file ? Array.from(new Uint8Array(await file.arrayBuffer())) : null })
      },
    })
  }, files)
}

/** Words, logos and lines stay inside WhatsApp Status's safe area: every pixel row above and below it is one plain colour. */
function expectSafeArea(png: PNG) {
  const rowPlain = (y: number) => {
    const at = (x: number) => png.data.readUInt32BE((y * png.width + x) * 4)
    for (let x = 1; x < png.width; x++) if (at(x) !== at(0)) return false
    return true
  }
  for (let y = 0; y < 250; y += 3) expect(rowPlain(y), `row ${y}`).toBe(true)
  for (let y = 1650; y < 1920; y += 3) expect(rowPlain(y), `row ${y}`).toBe(true)
}

test.describe('sharing (D-046; owner feedback 11 Nov 2026)', () => {
  test('on a phone that shares files, WhatsApp and Share send a sharp 1080x1920 picture inside Status’s safe area, the caption and the race’s link', async ({ page }, info) => {
    const full: string[] = []
    page.on('request', (r) => { if (/\/logos\/full\//.test(r.url())) full.push(r.url()) })
    await fakeShareSheet(page, true)
    await page.goto(`${ABA}#pu-01-01-01-001`)
    const share = page.getByRole('tabpanel').getByRole('region', { name: /Share this race/ })
    await share.scrollIntoViewIfNeeded()
    expect(full).toEqual([]) // the full-size logos load only when someone shares
    await share.getByRole('link', { name: 'Share on WhatsApp' }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(1)
    await share.getByRole('button', { name: 'Share', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(2)
    expect(full.length).toBe(5)
    const [wa, sheet] = await page.evaluate(() => (window as unknown as { shared: { text: string, type: string, bytes: number[] }[] }).shared)
    for (const s of [wa, sheet]) {
      expect(s.type).toBe('image/png')
      expect(s.text).toBe(`Check who is on your ballot:\nhttps://whosonmyballot.ng${ABA}#president`)
      const png = PNG.sync.read(Buffer.from(s.bytes))
      expect([png.width, png.height]).toEqual([1080, 1920])
      expectSafeArea(png)
    }
    fs.writeFileSync(info.outputPath('share-president.png'), Buffer.from(wa.bytes))
    await info.attach('share-president', { path: info.outputPath('share-president.png'), contentType: 'image/png' })
    await expect(page).toHaveURL(new RegExp(`${ABA}#pu-01-01-01-001`)) // still on the page
  })

  test('where files can’t be shared, WhatsApp opens with the caption and link, and Share sends them', async ({ page }) => {
    await fakeShareSheet(page, false)
    await page.goto(ABA)
    const share = page.getByRole('tabpanel').getByRole('region', { name: /Share this race/ })
    const wa = share.getByRole('link', { name: 'Share on WhatsApp' })
    expect(decodeURIComponent((await wa.getAttribute('href'))!)).toBe(`https://wa.me/?text=Check who is on your ballot:\nhttps://whosonmyballot.ng${ABA}#president`)
    await share.getByRole('button', { name: 'Share', exact: true }).click()
    const shared = await page.evaluate(() => (window as unknown as { shared: { text: string, url: string, type?: string }[] }).shared)
    expect(shared).toEqual([{ text: `Check who is on your ballot:\nhttps://whosonmyballot.ng${ABA}#president`, url: undefined, name: undefined, type: undefined, bytes: null }])
  })

  test('the candidate page shares its own address with the race picture', async ({ page }) => {
    await fakeShareSheet(page, true)
    await page.goto('/c/jan-2027-president-apc/')
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(1)
    const [s] = await page.evaluate(() => (window as unknown as { shared: { text: string, type: string }[] }).shared)
    expect(s.type).toBe('image/png')
    expect(s.text).toBe('Check who is on your ballot:\nhttps://whosonmyballot.ng/c/jan-2027-president-apc/')
  })

  test('on phones, a “Share on WhatsApp” tile fills the slot beside SDP; on wide screens it is not there', async ({ page }) => {
    await fakeShareSheet(page, true)
    await page.emulateMedia({ reducedMotion: 'reduce' }) // the cards' scroll-in movement would offset them mid-way
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(ABA)
    const panel = page.getByRole('tabpanel')
    const tile = panel.locator('li.wa-tile')
    await expect(tile).toBeVisible()
    const sdp = await panel.locator('.card[data-party="SDP"]').boundingBox()
    const t = await tile.boundingBox()
    expect(Math.abs(t!.y - sdp!.y)).toBeLessThan(2)
    expect(Math.abs(t!.height - sdp!.height)).toBeLessThan(2)
    await tile.getByRole('link').click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(1)
    await page.getByLabel(/Find a party or candidate/).first().fill('tinubu')
    await expect(tile).toBeHidden()
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByLabel(/Find a party or candidate/).first().fill('')
    await expect(tile).toBeHidden()
  })
})

test.describe('countdown (D-044)', () => {
  test('four boxes tick in Nigerian time; screen readers get the date and days left', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-18T08:59:59Z') })
    await page.goto('/')
    await page.clock.pauseAt(new Date('2026-11-18T09:00:00Z'))
    const clock = page.locator('.clock')
    await expect(clock.locator('[data-unit="days"]')).toHaveText('58')
    await expect(clock.locator('[data-unit="hours"]')).toHaveText('22')
    await expect(clock.locator('[data-unit="minutes"]')).toHaveText('30')
    await expect(clock.locator('[data-unit="seconds"]')).toHaveText('00')
    await expect(clock.locator('.clock-boxes')).toHaveAttribute('aria-hidden', 'true')
    await expect(clock.locator('[data-clock-sr]')).toHaveText('Polls open Saturday 16 January 2027 at 8:30 AM WAT: 58 days to go.')
    await page.clock.runFor(2000)
    await expect(clock.locator('[data-unit="seconds"]')).toHaveText('58')
    await expect(clock.locator('[aria-live]')).toHaveCount(0)
    await expect(clock.locator('li.next')).toContainText('16 January 2027')
  })

  test('after 16 January it counts to 6 February', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-01-17T07:29:59Z') })
    await page.goto('/')
    await page.clock.pauseAt(new Date('2027-01-17T07:30:00Z'))
    await expect(page.locator('.clock .clock-n')).toHaveText(['20', '00', '00', '00'])
    await expect(page.locator('.clock li.next')).toContainText('6 February 2027')
  })

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })
    test('the dates still show', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('.clock')).toContainText('Polls open Saturday 16 January 2027 at 8:30 AM WAT.')
      await expect(page.locator('.clock')).toContainText('16 January 2027')
      await expect(page.locator('.clock')).toContainText('6 February 2027')
      await expect(page.locator('.clock-boxes')).toBeHidden()
    })
  })
})

test('header: one slim row at 360px (mark, name, three buttons), the current section marked, stuck to the top', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/election-day/')
  const nav = page.getByRole('navigation', { name: 'Site' })
  await expect(nav.getByRole('link', { name: 'Election day' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'About' })).not.toHaveAttribute('aria-current')
  const name = page.getByRole('link', { name: 'Who’s on my ballot?' }).first()
  const boxes = await Promise.all([name, ...['Election day', 'Results', 'About'].map(n => nav.getByRole('link', { name: n }))].map(l => l.boundingBox()))
  for (const b of boxes) {
    expect(Math.abs(b!.y + b!.height / 2 - (boxes[0]!.y + boxes[0]!.height / 2))).toBeLessThan(4) // one row
    expect(b!.height).toBeGreaterThanOrEqual(44)
    expect(b!.height).toBeLessThan(56) // no label wraps
  }
  expect(boxes.at(-1)!.x + boxes.at(-1)!.width).toBeLessThanOrEqual(360)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  const header = page.locator('.site-header')
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(56)
  await page.mouse.wheel(0, 1500)
  await expect.poll(async () => (await header.boundingBox())!.y).toBe(0)
})

test('ballot: the race tabs stick under the header, and jumps land below both', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto(ABA)
  await page.mouse.wheel(0, 2500)
  const header = (await page.locator('.site-header').boundingBox())!
  const tabs = (await page.locator('.race-tabs').boundingBox())!
  await expect.poll(async () => (await page.locator('.race-tabs').boundingBox())!.y).toBeCloseTo(header.height, 0)
  expect(header.height + tabs.height).toBeLessThan(740 * 0.2) // the candidates keep most of the screen
  await page.getByRole('tabpanel').locator('a[href="/about/#order"]').scrollIntoViewIfNeeded()
  await page.goto('/c/jan-2027-president-apc/#src-1')
  const target = (await page.locator('#src-1').boundingBox())!
  expect(target.y).toBeGreaterThanOrEqual((await page.locator('.site-header').boundingBox())!.height)
})

test.describe('without JavaScript, the header still sticks', () => {
  test.use({ javaScriptEnabled: false })
  test('on a ballot page', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(ABA)
    await page.mouse.wheel(0, 3000)
    await expect.poll(async () => (await page.locator('.site-header').boundingBox())!.y).toBe(0)
  })
})

test('no link is ever underlined, at rest, on hover or on focus; links in text are bold with an arrow', async ({ page }) => {
  test.setTimeout(120_000)
  for (const path of ['/', '/about/', '/election-day/', '/results/', ABA, '/c/jan-2027-president-apc/', '/state/01/']) {
    await page.goto(path)
    const bad = await page.evaluate(() => [...document.querySelectorAll('a')].filter(a => a.getClientRects().length && getComputedStyle(a).textDecorationLine.includes('underline')).map(a => a.textContent))
    expect(bad, path).toEqual([])
    for (const a of (await page.locator('main a:visible, header a:visible').all()).slice(0, 5)) {
      await a.hover({ force: true, timeout: 3000 })
      expect(await a.evaluate(e => getComputedStyle(e).textDecorationLine), path).not.toContain('underline')
      await a.focus({ timeout: 3000 })
      expect(await a.evaluate(e => getComputedStyle(e).textDecorationLine), path).not.toContain('underline')
    }
    // a link inside a sentence is bold and carries the arrow
    const inText = await page.evaluate(() => [...document.querySelectorAll('main p:not(.credit) a:not(.btn, .ref), main ul:not([class]) > li a:not([data-tab])')].filter(a => a.getClientRects().length && !a.querySelector('.ext')).map(a => ({ w: getComputedStyle(a).fontWeight, arrow: getComputedStyle(a, '::after').maskImage || getComputedStyle(a, '::after').webkitMaskImage })))
    for (const l of inText) {
      expect(Number(l.w), path).toBeGreaterThanOrEqual(700)
      expect(l.arrow, path).toContain('svg')
    }
  }
})

test('header buttons match: rectangles, same corners, height and border; the current one marked the same way', async ({ page }) => {
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    for (const [path, current] of [['/election-day/', 'Election day'], ['/results/', 'Results'], ['/about/', 'About']] as const) {
      await page.goto(path)
      const nav = page.getByRole('navigation', { name: 'Site' })
      const looks = await Promise.all(['Election day', 'Results', 'About'].map(n => nav.getByRole('link', { name: n }).evaluate((e) => {
        const s = getComputedStyle(e)
        const r = e.getBoundingClientRect()
        return { h: r.height, w: r.width, radius: s.borderTopLeftRadius, border: s.borderTopWidth, bg: s.backgroundColor, current: e.getAttribute('aria-current') }
      })))
      for (const l of looks) {
        expect(l.h, `${width} ${path}`).toBe(looks[0].h)
        expect(l.h).toBeGreaterThanOrEqual(44)
        expect(l.radius).toBe(looks[0].radius)
        expect(Number.parseFloat(l.radius)).toBeLessThanOrEqual(8) // gently rounded: never a pill or a circle
        expect(l.border).toBe(looks[0].border)
        expect(l.w).toBeGreaterThan(l.h) // a short word stays a rectangle
      }
      const marked = looks.filter(l => l.current)
      expect(marked).toHaveLength(1)
      expect(marked[0].bg, `${width} ${current}`).toBe('rgb(255, 255, 255)')
      for (const l of looks.filter(x => !x.current)) expect(l.bg).not.toBe('rgb(255, 255, 255)')
    }
  }
})

test('the credit: one italic line, the name a link with no arrow, the heart text-sized and slanted', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  const credit = page.locator('.site-footer .credit')
  await expect(credit).toHaveText('Built by Anthony Ugwuja with ❤️')
  const c = await credit.evaluate((p) => {
    const a = p.querySelector('a')!
    const h = p.querySelector('.heart')!
    const lines = new Set([...p.getClientRects()].map(r => Math.round(r.top)))
    return {
      italic: getComputedStyle(p).fontStyle, aItalic: getComputedStyle(a).fontStyle, href: a.getAttribute('href'),
      arrow: getComputedStyle(a, '::after').content, deco: getComputedStyle(a).textDecorationLine,
      heartSize: getComputedStyle(h).fontSize, textSize: getComputedStyle(p).fontSize, skew: getComputedStyle(h).transform,
      oneLine: lines.size === 1 && Math.abs(h.getBoundingClientRect().top - a.getBoundingClientRect().top) < 16,
    }
  })
  expect(c).toMatchObject({ italic: 'italic', aItalic: 'italic', href: 'https://anthonyugwuja.dev', deco: 'none', oneLine: true })
  expect(['none', 'normal']).toContain(c.arrow)
  expect(c.heartSize).toBe(c.textSize)
  expect(c.skew).not.toBe('none')
})
