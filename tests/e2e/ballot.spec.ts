import fs from 'node:fs'

import { expect, type Page, test } from '@playwright/test'
import { PNG } from 'pngjs'

import { settled } from './settled'

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
    await expect(page.getByRole('tab', { name: /House of Representatives/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: /^House of Representatives:/, level: 2 })).toBeVisible()
  })

  test('keyboard: arrows, Home and End move between tabs and show each race', async ({ page }) => {
    await page.goto(ABA)
    await page.getByRole('tab', { name: /President/ }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /Senate/ })).toBeFocused()
    await expect(page.getByRole('tab', { name: /Senate/ })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End')
    await expect(page.getByRole('tab', { name: /House of Representatives/ })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /President/ })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('tab', { name: /House of Representatives/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toHaveCount(1)
  })

  test('“Next” buttons lead through every race, and the polling unit stays in the address', async ({ page }) => {
    await page.goto(`${ABA}#pu-01-01-01-001`)
    await expect(page.getByText('Your polling unit: RAILWAY QUARTERS - RAILWAY QUARTERS I')).toBeVisible()
    await page.getByRole('link', { name: 'Next: Senate' }).click()
    await expect(page.getByRole('tab', { name: /Senate/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/#pu-01-01-01-001&senate$/)
    await page.getByRole('link', { name: 'Next: House of Representatives' }).click()
    await expect(page.getByRole('tab', { name: /House of Representatives/ })).toBeFocused()
    await expect(page.getByRole('link', { name: /^Next:/ })).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Your polling unit: RAILWAY QUARTERS - RAILWAY QUARTERS I')).toBeVisible()
    await expect(page.getByRole('tab', { name: /House of Representatives/ })).toHaveAttribute('aria-selected', 'true')
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

  test('a candidate page leads to its race on its own, never to a ballot for a place the visitor didn’t pick', async ({ page }) => {
    await page.goto('/c/jan-2027-president-apc/')
    expect(await page.locator('main a[href^="/ballot"]').count()).toBe(0)
    await page.getByRole('link', { name: 'Everyone in this race' }).click()
    await expect(page).toHaveURL(/\/race\/jan-2027-president\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('President - 16 January 2027')
    await expect(page.getByRole('link', { name: 'Choose your state' })).toHaveAttribute('href', '/#by-state')
    await page.goto('/c/jan-2027-house-abia-aba-north-aba-south-apc/')
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: /House of Representatives/ }).click()
    await expect(page).toHaveURL(/\/race\/jan-2027-house-abia-aba-north-aba-south\/$/)
  })

  test('a ballot reached without choosing a place asks the visitor to choose first; a chosen polling unit replaces that', async ({ page }) => {
    await page.goto(ABA)
    const box = page.locator('[data-lookup="confirm"]')
    await expect(box).toContainText('Did you choose this place?')
    await expect(box.getByRole('link', { name: 'Choose your state' })).toBeVisible()
    await page.goto(`${ABA}#pu-01-01-01-001`)
    await expect(box).toContainText('Your polling unit:')
    await expect(box).not.toContainText('Did you choose this place?')
  })

  test('6 February: Governor and State Assembly tabs', async ({ page }) => {
    await page.goto('/ballot-feb/lagos/surulere-ii/')
    await expect(page.getByRole('tab')).toHaveText([/Governor/, /Assembly/])
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

test('in Abia, the Senate tab labels its first group with the state rule, the Sources section cites the result, and nothing scrolls sideways', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(ABA)
  await page.getByRole('tab', { name: /Senate/ }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByRole('heading', { name: 'Four of the five parties with the most candidates in 2027, and LP, which won Abia’s last governorship election' })).toBeVisible()
  // the citation is with the page's other references, after the candidates (owner feedback, 13 Nov 2026)
  await expect(page.getByRole('region', { name: 'Sources' }).getByRole('link', { name: /LP won Abia’s governorship election of 18 March 2023, as declared by INEC/ }).first()).toBeAttached()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test.describe('the grid', () => {
  test('two cards per row on a phone, names whole, the first group labelled, no sideways scroll', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }) // the cards' entrance would offset them mid-way
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

/** The picture handed to the share menu, decoded in the page: its size, the plain edges, and where the words sit in each green band. */
async function pictureCheck(page: Page, bytes: number[]) {
  return page.evaluate(async (bytes) => {
    const img = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    const data = g.getImageData(0, 0, c.width, c.height).data
    // a row is plain when every pixel is within a JPEG's rounding of the row's first pixel
    const plain = (y: number) => {
      const o = y * c.width * 4
      for (let x = 1; x < c.width; x++) for (let k = 0; k < 3; k++) if (Math.abs(data[o + x * 4 + k] - data[o + k]) > 12) return false
      return true
    }
    const outside: number[] = []
    for (let y = 0; y < 80; y += 2) if (!plain(y)) outside.push(y)
    for (let y = 1920 - 2; y >= 1920 - 80; y -= 2) if (!plain(y)) outside.push(y)
    // Each green band: the rows from the edge whose first pixel is the band's colour; the words' rows and columns inside it.
    const same = (o: number, q: number) => [0, 1, 2].every(k => Math.abs(data[o + k] - data[q + k]) <= 12)
    // a band row starts with green (the bands are a gradient, so no one colour)
    const green = (o: number) => data[o + 1] > data[o] + 40 && data[o + 1] > data[o + 2] + 10
    const inBand = (y: number) => green(y * c.width * 4)
    const words = (from: number, to: number) => {
      let [y0, y1, x0, x1] = [Infinity, -1, Infinity, -1]
      for (let y = from; y < to; y++) {
        const o = y * c.width * 4
        for (let x = 0; x < c.width; x++) {
          if (!same(o + x * 4, o)) {
            y0 = Math.min(y0, y)
            y1 = Math.max(y1, y)
            x0 = Math.min(x0, x)
            x1 = Math.max(x1, x)
          }
        }
      }
      return { above: y0 - from, below: to - 1 - y1, left: x0, right: c.width - 1 - x1 }
    }
    let topEnd = 0
    while (inBand(topEnd)) topEnd++
    let footStart = c.height - 1
    while (inBand(footStart - 1)) footStart--
    return { w: img.width, h: img.height, outside, top: words(0, topEnd), foot: words(footStart, c.height) }
  }, bytes)
}

test.describe('sharing (D-046; owner feedback 11 Nov 2026)', () => {
  test('on a phone that shares files, WhatsApp and Share send a 1080x1920 PNG with the words centred in its bands, with the caption and the home page', async ({ page }, info) => {
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
    const [wa, sheet] = await page.evaluate(() => (window as unknown as { shared: { text: string, type: string, name: string, bytes: number[] }[] }).shared)
    for (const s of [wa, sheet]) {
      expect(s.type).toBe('image/png')
      expect(s.name).toBe('whos-on-my-ballot.png')
      expect(s.text).toBe('Check who is on your ballot:\nhttps://whosonmyballot.ng/')
      const p = await pictureCheck(page, s.bytes)
      expect([p.w, p.h]).toEqual([1080, 1920])
      expect(p.outside, 'the top 80 rows and the bottom 80 rows hold no words').toEqual([])
      // the words in each band are centred in it, up and down (within the glyphs' own ascent and descent) and across
      expect(Math.abs(p.top.above - p.top.below), JSON.stringify(p.top)).toBeLessThan(24)
      expect(Math.abs(p.foot.above - p.foot.below), JSON.stringify(p.foot)).toBeLessThan(16)
      expect(Math.abs(p.foot.left - p.foot.right), JSON.stringify(p.foot)).toBeLessThan(8)
    }
    fs.writeFileSync(info.outputPath('share-president.png'), Buffer.from(wa.bytes))
    await info.attach('share-president', { path: info.outputPath('share-president.png'), contentType: 'image/png' })
    await expect(page).toHaveURL(new RegExp(`${ABA}#pu-01-01-01-001`)) // still on the page
  })

  test('where files can’t be shared, WhatsApp opens with the caption and the home page; Copy link copies this page, without the polling unit', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await fakeShareSheet(page, false)
    await page.goto(`${ABA}#pu-01-01-01-001`)
    const share = page.getByRole('tabpanel').getByRole('region', { name: /Share this race/ })
    const wa = share.getByRole('link', { name: 'Share on WhatsApp' })
    expect(decodeURIComponent((await wa.getAttribute('href'))!)).toBe('https://wa.me/?text=Check who is on your ballot:\nhttps://whosonmyballot.ng/')
    await share.getByRole('button', { name: 'Share', exact: true }).click()
    const shared = await page.evaluate(() => (window as unknown as { shared: { text: string, url: string, type?: string }[] }).shared)
    expect(shared).toEqual([{ text: 'Check who is on your ballot:\nhttps://whosonmyballot.ng/', url: undefined, name: undefined, type: undefined, bytes: null }])
    await share.getByRole('button', { name: 'Copy link' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://whosonmyballot.ng${ABA}`)
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

  test('on phones, the slot beside SDP holds the words and WhatsApp’s glyph on a button, with no box; on wide screens it is not there', async ({ page }) => {
    await fakeShareSheet(page, true)
    await page.emulateMedia({ reducedMotion: 'reduce' }) // the cards' scroll-in movement would offset them mid-way
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(ABA)
    const panel = page.getByRole('tabpanel')
    const tile = panel.locator('li.wa-tile')
    await expect(tile).toBeVisible()
    await expect(tile).toContainText('Share on WhatsApp')
    await expect(tile.locator('.wa-tile-button .wa-glyph')).toBeVisible()
    const look = await tile.locator('a').evaluate(a => ({ border: getComputedStyle(a).borderTopStyle, bg: getComputedStyle(a).backgroundColor }))
    expect(look.border).toBe('none')
    expect(look.bg).toBe('rgba(0, 0, 0, 0)')
    const sdp = await panel.locator('.card[data-party="SDP"]').boundingBox()
    const t = await tile.boundingBox()
    expect(Math.abs(t!.y - sdp!.y)).toBeLessThan(2)
    expect(Math.abs(t!.height - sdp!.height)).toBeLessThan(2) // the same space as a card, so the grid stays even
    await tile.getByRole('link').click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(1)
    await page.getByLabel(/Find a party or candidate/).first().fill('tinubu')
    await expect(tile).toBeHidden()
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByLabel(/Find a party or candidate/).first().fill('')
    await expect(tile).toBeHidden()
  })

  test('race tabs are equal boxes with the count in a true circle, the same 8 px gap after every label, nothing outside its box', async ({ browser }) => {
    // The site uses each phone's own font (no web fonts), so widths differ by machine. Phones use Roboto or San Francisco;
    // the test measures with Liberation Sans (Arial's widths, close to both, and installed on CI with Chrome), so every
    // machine gets the same answer. The wider DejaVu Sans that a bare Linux falls back to is not a phone font.
    const context = await browser.newContext({ bypassCSP: true })
    const page = await context.newPage()
    for (const url of [ABA, '/ballot-feb/abia/umuahia-central-or-umuahia-east-or-umuahia-north/']) {
      for (const width of [320, 360, 390, 1280]) {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(url)
        await page.addStyleTag({ content: '.race-tabs a { font-family: "Liberation Sans", Arial, sans-serif !important }' })
        const boxes = await page.locator('.race-tabs a').evaluateAll(as => as.map((a) => {
          const r = a.getBoundingClientRect()
          const li = a.parentElement!.getBoundingClientRect()
          const c = a.querySelector('.tab-count')!.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(a.querySelector('.tab-name')!)
          const t = range.getBoundingClientRect()
          return {
            w: Math.round(r.width), h: Math.round(r.height), cw: Math.round(c.width), ch: Math.round(c.height),
            wraps: a.querySelector('.tab-name')!.getClientRects().length, gap: Math.round(c.left - t.right),
            inside: t.left >= r.left && c.right <= r.right && r.width <= li.width + 0.5,
          }
        }))
        for (const b of boxes) {
          expect(b.w, `${url} ${width}`).toBe(boxes[0].w)
          expect(b.h).toBe(boxes[0].h)
          expect(b.cw).toBe(b.ch)
          expect(b.wraps).toBe(1)
          expect(b.gap, `${url} ${width}`).toBe(8)
          expect(b.inside, `${url} ${width}`).toBe(true)
        }
      }
    }
    await context.close()
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
    // a link inside a sentence is bold green; no link anywhere carries an arrow (owner feedback, 11 Nov 2026)
    const inText = await page.evaluate(() => [...document.querySelectorAll('main p:not(.credit) a:not(.btn, .ref), main ul:not([class]) > li a:not([data-tab])')].filter(a => a.getClientRects().length).map(a => getComputedStyle(a).fontWeight))
    for (const w of inText) expect(Number(w), path).toBeGreaterThanOrEqual(700)
    const arrows = await page.evaluate(() => [...document.querySelectorAll('a')].filter(a => ['::before', '::after'].some(p => !['none', 'normal'].includes(getComputedStyle(a, p).content)) || a.querySelector('svg.ext')).map(a => a.textContent))
    expect(arrows, path).toEqual([])
  }
})

test('header buttons match: rectangles, same corners, height and border; the current one marked the same way', async ({ page }) => {
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    for (const [path, current] of [['/election-day/', 'Election day'], ['/results/', 'Results'], ['/about/', 'About']] as const) {
      await page.goto(path)
      const nav = page.getByRole('navigation', { name: 'Site' })
      const looks = await Promise.all(['Election day', 'Results', 'About'].map(n => nav.getByRole('link', { name: n }).evaluate((a) => {
        const box = a.querySelector('span')!
        const s = getComputedStyle(box)
        const r = box.getBoundingClientRect()
        return { tap: a.getBoundingClientRect().height, h: r.height, w: r.width, radius: s.borderTopLeftRadius, border: s.borderTopWidth, bg: s.backgroundColor, current: a.getAttribute('aria-current') }
      })))
      for (const l of looks) {
        expect(l.h, `${width} ${path}`).toBe(looks[0].h)
        expect(l.tap).toBeGreaterThanOrEqual(44) // still easy to tap
        if (width < 480) expect(l.h).toBeLessThanOrEqual(28) // slim on phones
        expect(l.radius).toBe(looks[0].radius)
        expect(Number.parseFloat(l.radius)).toBeLessThanOrEqual(8) // gently rounded: never a pill or a circle
        expect(l.border).toBe('1px')
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
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    const centre = await credit.evaluate((p) => {
      const r = document.createRange()
      r.selectNodeContents(p)
      const t = r.getBoundingClientRect()
      const b = p.getBoundingClientRect()
      return Math.abs((t.left - b.left) - (b.right - t.right))
    })
    expect(centre, `${width}`).toBeLessThan(4) // centred
  }
  await page.goto('/about/')
  await expect(page.locator('.credit')).toHaveCount(1) // the footer's only
})

test('with motion on, everything that fades in on scroll ends fully opaque and in place once on screen (D-058, D-066)', async ({ page }) => {
  test.setTimeout(180_000) // the entrance takes 0.7 s at every step
  for (const path of ['/', '/c/jan-2027-president-ndc/', ABA]) {
    await page.goto(path)
    await settled(page) // the load animations first
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < height; y += 300) {
      await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y)
      // motion.js plays a 0.7 s entrance as each one appears
      await page.waitForTimeout(900)
      // anything wholly inside the screen and below the sticky bars has finished its entrance
      const half = await page.evaluate(() => [...document.querySelectorAll('.card, .panel, .link-list > li, .timeline > li, .sources > li')].filter((e) => {
        const r = e.getBoundingClientRect()
        return r.top > 140 && r.bottom < innerHeight && r.height > 0 && (Number(getComputedStyle(e).opacity) < 0.99)
      }).length)
      expect(half, `${path} at ${y}`).toBe(0)
    }
  }
})

test('the scroll-in motion is clearly visible: a card below the screen starts invisible and 48px low, then arrives (D-066)', async ({ page }) => {
  await page.goto('/race/jan-2027-president/')
  await settled(page)
  expect(await page.evaluate(() => document.documentElement.classList.contains('rv-js'))).toBe(true)
  // what was on screen at load never waits
  expect(await page.evaluate(() => [...document.querySelectorAll('.rv-wait')].filter(e => e.getBoundingClientRect().top - 48 < innerHeight).length)).toBe(0)
  const last = page.locator('.card').last()
  const before = await last.evaluate(e => ({ o: Number(getComputedStyle(e).opacity), t: getComputedStyle(e).transform }))
  expect(before.o).toBeLessThan(0.05)
  expect(before.t).toMatch(/matrix\(1, 0, 0, 1, 0, 4[0-9]/)
  await last.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForTimeout(900)
  const after = await last.evaluate(e => ({ o: Number(getComputedStyle(e).opacity), t: getComputedStyle(e).transform }))
  expect(after.o).toBeGreaterThan(0.99)
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(after.t)
})

test('with reduced motion, nothing waits or moves on scroll', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/race/jan-2027-president/')
  const last = page.locator('.card').last()
  expect(await last.evaluate(e => [getComputedStyle(e).opacity, getComputedStyle(e).transform, getComputedStyle(e).animationName])).toEqual(['1', 'none', 'none'])
  expect(await page.evaluate(() => document.documentElement.classList.contains('rv-js'))).toBe(false)
})

test('every button that takes the voter somewhere is solid green with white text; on a phone it sits in the middle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const path of ['/', '/state/24/', ABA, '/c/jan-2027-president-apc/', '/about/', '/election-day/']) {
    await page.goto(path)
    // a button alone in its row; a pair side by side (the home page's two) shares the row
    const looks = await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('main a.btn, footer a.btn')].filter(a => a.getClientRects().length && !a.classList.contains('btn-wa') && a.parentElement!.children.length === 1).map((a) => {
      const s = getComputedStyle(a)
      const r = a.getBoundingClientRect()
      const box = a.parentElement!.getBoundingClientRect()
      const cs = getComputedStyle(a.parentElement!)
      const pad = parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      return { text: a.textContent, bg: s.backgroundColor, fg: s.color, off: Math.abs((r.left + r.right) / 2 - (box.left + box.right + pad) / 2) }
    }))
    expect(looks.length, path).toBeGreaterThan(0)
    for (const l of looks) {
      expect(l.bg, `${path}: ${l.text}`).toBe('rgb(0, 135, 81)')
      expect(l.fg, `${path}: ${l.text}`).toBe('rgb(255, 255, 255)')
      expect(l.off, `${path}: ${l.text} is off-centre`).toBeLessThan(2)
    }
  }
})

test('tapping a state tile fills it solid green with white text at once, before the next page opens', async ({ page }) => {
  await page.goto('/')
  // hold the page where it is at the moment of the tap (the fill is put on as the tap lands, before any navigation)
  await page.evaluate(() => document.addEventListener('click', e => e.preventDefault()))
  const tile = page.locator('.link-list a[href^="/state/"]').first()
  await tile.scrollIntoViewIfNeeded()
  await tile.click()
  const look = await tile.evaluate(a => ({ tapped: a.classList.contains('tapped'), bg: getComputedStyle(a).backgroundColor, fg: getComputedStyle(a).color }))
  expect(look).toEqual({ tapped: true, bg: 'rgb(0, 135, 81)', fg: 'rgb(255, 255, 255)' })
})
