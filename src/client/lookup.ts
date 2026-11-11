/**
 * The site's only script (decision D-022). It enhances three static forms:
 *   [data-lookup="code"]    find a polling unit from the PVC delimitation code
 *   [data-lookup="search"]  find a polling unit by name or nearby landmark within one LGA (on the home page the
 *                           visitor picks the state too, and its LGAs are filled in from that state's file)
 *   [data-lookup="confirm"] on a ballot page, name the polling unit chosen (from the URL fragment) and link its
 *                           ballot for the other election day; without one, the page keeps asking the visitor to choose first
 *   [data-tabs]             a ballot's races as tabs, one race at a time, the choice kept in the address fragment
 *   [data-filter]           narrow a race's cards by party or name, in the browser only
 *   [data-share]            share a race: the phone's share menu, with a picture of the race drawn here when it can take files
 *   [data-copy]             copy a page's link to the clipboard
 *   [data-clock]            the countdown to the next election day in Nigerian time (no live announcements)
 * Privacy (D-015): the only network request is GET /data/pu/<SS>.json, a fixed per-state file. What the visitor
 * types is matched in memory, never sent, never stored, and never put in a URL (fragments aren't sent to servers).
 */
import { describePhase, formatDay, formatTime, phaseAt, type Schedule } from '../lib/election'
import {
  cardCode,
  codeFromHash,
  findByCode,
  type FoundPollingUnit,
  parseDelimitationCode,
  puHash,
  searchLga,
  type StateSearchData,
  tabFromHash,
  hashWithTab,
} from '../lib/core'

const cache = new Map<string, Promise<StateSearchData>>()

function stateData(code: string): Promise<StateSearchData> {
  let p = cache.get(code)
  if (!p) {
    // Same-origin credentials: the site sets no cookies, so in production nothing is sent. A protected preview's login
    // cookie must go with the request, or the host answers with a redirect to its login page, which the CSP blocks.
    p = fetch(`/data/pu/${code}.json`, { credentials: 'same-origin', referrerPolicy: 'no-referrer' }).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json() as Promise<StateSearchData>
    })
    p.catch(() => cache.delete(code))
    cache.set(code, p)
  }
  return p
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, attrs: Record<string, string> = {}) {
  const e = document.createElement(tag)
  if (text !== undefined) e.textContent = text
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

function puLink(pu: FoundPollingUnit): HTMLAnchorElement {
  const a = el('a', '', { href: `${pu.ballotPath}${puHash(pu.code)}` })
  a.append(el('strong', pu.name), document.createTextNode(` · ${pu.ward} ward, ${pu.lga} · `), el('span', cardCode(pu.code), { class: 'code' }))
  return a
}

/** The 6 February ballot for the same polling unit (its ward decides it). */
function febLink(pu: FoundPollingUnit): HTMLAnchorElement {
  return el('a', '6 February 2027 ballot', { href: `${pu.febBallotPath}${puHash(pu.code)}`, class: 'feb-link' })
}

function resultItem(pu: FoundPollingUnit): HTMLLIElement {
  const li = el('li')
  li.append(puLink(pu), febLink(pu))
  return li
}

function show(result: Element, ...nodes: Node[]) {
  result.replaceChildren(...nodes)
}

/** Each submission takes a number; only the latest may write its result, so a slow earlier answer can't overwrite a newer one. */
function latestOnly() {
  let seq = 0
  return () => {
    const mine = ++seq
    return () => mine === seq
  }
}

function setupCode(form: HTMLFormElement) {
  const input = form.querySelector('input')!
  const result = form.querySelector('.result')!
  const begin = latestOnly()
  form.hidden = false
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const current = begin()
    const code = parseDelimitationCode(input.value)
    if (!code) {
      show(result, el('p', 'That doesn’t look like the code on a voter’s card. It has four parts, like 24-15-03-012.'))
      return
    }
    show(result, el('p', 'Looking up…'))
    let pu: FoundPollingUnit | null = null
    try {
      const data = await stateData(code.slice(0, 2))
      if (!current()) return
      pu = findByCode(data, code)
    }
    catch {
      if (current()) show(result, el('p', 'We couldn’t load the polling-unit list. Check your connection and try again.'))
      return
    }
    if (!pu) {
      show(result, el('p', `We couldn’t find ${cardCode(code)} in INEC’s list of polling units. Check the code on your card, or pick your state above.`))
      return
    }
    const ul = el('ul')
    ul.append(resultItem(pu))
    show(result, el('p', 'Is this your polling unit? Choose it to see your ballot for 16 January, or choose the 6 February ballot.'), ul)
  })
}

function setupSearch(form: HTMLFormElement) {
  let state = form.dataset.state ?? ''
  const stateSelect = form.querySelector<HTMLSelectElement>('select[name="state"]')
  const lga = form.querySelector<HTMLSelectElement>('select[name="lga"]')!
  const input = form.querySelector('input')!
  const result = form.querySelector('.result')!
  const begin = latestOnly()
  form.hidden = false
  if (stateSelect) {
    // Home page: the LGAs come from the chosen state's file, the same file the search then uses.
    const pick = latestOnly()
    stateSelect.addEventListener('change', async () => {
      const current = pick()
      state = stateSelect.value
      lga.disabled = true
      lga.replaceChildren(el('option', 'Loading the LGAs…', { value: '' }))
      try {
        const data = await stateData(state)
        if (!current()) return
        lga.replaceChildren(el('option', 'Choose your LGA', { value: '', disabled: '', selected: '' }), ...data.lgas.map(([code, name]) => el('option', name, { value: code })))
        lga.disabled = false
      }
      catch {
        if (current()) lga.replaceChildren(el('option', 'Couldn’t load the LGAs. Check your connection and choose the state again.', { value: '' }))
      }
    })
  }
  else {
    const prefetch = () => void stateData(state).catch(() => {})
    lga.addEventListener('change', prefetch, { once: true })
    input.addEventListener('focus', prefetch, { once: true })
  }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const current = begin()
    if (!state) {
      show(result, el('p', 'Choose your state first.'))
      stateSelect?.focus()
      return
    }
    if (!lga.value) {
      show(result, el('p', 'Choose your LGA first.'))
      lga.focus()
      return
    }
    if (!input.value.trim()) {
      show(result, el('p', 'Type the name of your polling unit or a landmark near it.'))
      return
    }
    let hits
    try {
      const data = await stateData(state)
      if (!current()) return
      hits = searchLga(data, lga.value, input.value)
    }
    catch {
      if (current()) show(result, el('p', 'We couldn’t load the polling-unit list. Check your connection and try again.'))
      return
    }
    if (!hits.length) {
      show(result, el('p', 'No close matches in this LGA. Try another word, or browse your LGA’s wards below.'))
      return
    }
    const ul = el('ul')
    for (const h of hits) ul.append(resultItem(h))
    show(result, el('p', `Is one of these your polling unit? ${hits.length === 1 ? 'Choose it' : 'Choose yours'} to see your ballot for 16 January, or choose the 6 February ballot.`), ul)
  })
}

async function setupConfirm(box: HTMLElement) {
  const code = codeFromHash(location.hash)
  if (!code || code.slice(0, 2) !== box.dataset.state) return
  try {
    const pu = findByCode(await stateData(code.slice(0, 2)), code)
    if (!pu) return
    const here = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`
    const feb = box.dataset.election === 'feb'
    const mine = feb ? pu.febBallotPath : pu.ballotPath
    box.classList.remove('choose-first')
    box.replaceChildren(el('p', `Your polling unit: ${pu.name}, ${pu.ward} ward, ${pu.lga} LGA (${cardCode(pu.code)}).`))
    if (mine !== here) {
      box.append(el('p', 'This polling unit belongs to a different ballot. Follow the link below.'))
      box.append(feb ? febLink(pu) : puLink(pu))
    }
    // the same polling unit's ballot for the other election day
    const other = feb
      ? el('a', 'Your ballot for 16 January 2027', { href: `${pu.ballotPath}${puHash(pu.code)}` })
      : el('a', 'Your ballot for 6 February 2027', { href: `${pu.febBallotPath}${puHash(pu.code)}` })
    const p = el('p')
    p.append(other)
    box.append(p)
    box.hidden = false
  }
  catch {
    // The ballot is complete without the name; nothing to show.
  }
}

for (const node of document.querySelectorAll<HTMLElement>('[data-lookup]')) {
  if (node.dataset.lookup === 'code') setupCode(node as HTMLFormElement)
  else if (node.dataset.lookup === 'search') setupSearch(node as HTMLFormElement)
  else if (node.dataset.lookup === 'confirm') {
    // Also when a polling unit is chosen without a reload (the address's fragment changes); not when only the race tab does.
    let last = codeFromHash(location.hash)
    void setupConfirm(node)
    window.addEventListener('hashchange', () => {
      const code = codeFromHash(location.hash)
      if (code && code !== last) void setupConfirm(node)
      last = code
    })
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
  if (!navigator.clipboard) continue
  button.hidden = false
  const label = button.textContent ?? 'Copy link'
  button.addEventListener('click', () => {
    navigator.clipboard.writeText(button.dataset.copy!).then(
      () => { button.textContent = 'Link copied' },
      () => { button.textContent = 'Couldn’t copy: copy it from the address bar' },
    ).finally(() => setTimeout(() => { button.textContent = label }, 4000))
  })
}


// ---- Race tabs (WAI-ARIA tabs pattern; automatic activation). Without this script the races show one after another.
function setupTabs(nav: HTMLElement) {
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[data-tab]')]
  const panels = links.map(a => document.getElementById(a.dataset.tab!)!)
  const list = nav.querySelector('ul')!
  list.setAttribute('role', 'tablist')
  links.forEach((a, i) => {
    a.parentElement!.setAttribute('role', 'presentation')
    a.id = `tab-${a.dataset.tab}`
    a.setAttribute('role', 'tab')
    a.setAttribute('aria-controls', panels[i].id)
    panels[i].setAttribute('role', 'tabpanel')
    panels[i].setAttribute('aria-labelledby', a.id)
    panels[i].tabIndex = 0
  })
  nav.classList.add('is-tabs')
  let current = -1
  const select = (i: number, how: { focus?: boolean, remember?: boolean, scroll?: boolean } = {}) => {
    links.forEach((a, j) => {
      a.setAttribute('aria-selected', String(i === j))
      a.tabIndex = i === j ? 0 : -1
      panels[j].hidden = i !== j
    })
    if (i !== current && current !== -1) {
      panels[i].classList.remove('fade')
      void panels[i].offsetWidth // restart the reveal
      panels[i].classList.add('fade')
    }
    current = i
    if (how.remember) history.replaceState(null, '', hashWithTab(location.hash, links[i].dataset.tab!))
    if (how.scroll) {
      // Bring the race's start just under the header and the tabs, which both stay stuck to the top.
      const y = panels[i].getBoundingClientRect().top + window.scrollY - (Number.parseFloat(getComputedStyle(nav).top) || 0) - nav.offsetHeight - 8
      if (window.scrollY > y || how.focus) window.scrollTo({ top: Math.max(0, y) })
    }
    if (how.focus) links[i].focus({ preventScroll: true })
  }
  const fromHash = () => {
    const t = tabFromHash(location.hash)
    const target = t ? document.getElementById(t) : null
    const i = target ? panels.findIndex(p => p.contains(target)) : -1
    select(i === -1 ? Math.max(current, 0) : i)
    if (target && !panels.includes(target)) target.scrollIntoView()
  }
  links.forEach((a, i) => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault()
      select(i, { remember: true, scroll: true })
    })
    a.addEventListener('keydown', (ev) => {
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: links.length - 1 }[ev.key]
      if (next !== undefined) {
        ev.preventDefault()
        select((next + links.length) % links.length, { focus: true, remember: true })
      }
      else if (ev.key === ' ') {
        ev.preventDefault()
        select(i, { remember: true, scroll: true })
      }
    })
  })
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-next]')) {
    a.addEventListener('click', (ev) => {
      ev.preventDefault()
      select(links.findIndex(l => l.dataset.tab === a.dataset.next), { focus: true, remember: true, scroll: true })
    })
  }
  window.addEventListener('hashchange', fromHash)
  fromHash()
}

// ---- Filter a race's cards as the visitor types. Nothing typed leaves the browser.
function setupFilter(box: HTMLElement) {
  const input = box.querySelector('input')!
  const status = box.querySelector('.filter-none')!
  const race = box.closest('.race')!
  const cards = [...race.querySelectorAll<HTMLElement>('.card')]
  const groups = [...race.querySelectorAll<HTMLElement>('.group')]
  input.addEventListener('input', () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean)
    let shown = 0
    for (const c of cards) {
      c.hidden = !words.every(w => c.dataset.words!.includes(w))
      if (!c.hidden) shown++
    }
    for (const g of groups) g.hidden = !g.querySelector('.card:not([hidden])')
    for (const t of race.querySelectorAll<HTMLElement>('[data-wa-tile]')) t.hidden = words.length > 0
    status.textContent = !words.length ? '' : shown ? `Showing ${shown} of ${cards.length}.` : 'No party or candidate in this race matches.'
  })
}

// ---- Share a race: a portrait picture for WhatsApp Status, drawn here only when someone starts to share.
interface ShareInfo { text: string, url: string, title: string, tiles: [string, string, string, string][], more: number }
const GREEN = '#008751'
const DEEP = '#00552f'
const INK = '#161616'
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Lines of `text` no wider than `max`; a word too long for a line is broken, so nothing is ever cut off. */
function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const tryLine = line ? `${line} ${word}` : word
    if (g.measureText(tryLine).width <= max) {
      line = tryLine
      continue
    }
    if (line) lines.push(line)
    line = ''
    for (const ch of word) {
      if (g.measureText(line + ch).width > max && line) {
        lines.push(line)
        line = ''
      }
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

/** The largest size from `size` down to `min` at which `text` fits in `maxLines`; at `min` it takes the lines it needs. */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, min: number, max: number, maxLines: number) {
  for (let s = size; ; s -= 2) {
    g.font = `${weight} ${s}px ${FONT}`
    const lines = wrap(g, text, max)
    if (lines.length <= maxLines || s <= min) return { size: s, lines }
  }
}

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Draw `img` fitted inside a w x h box, centred, never stretched. */
function contain(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * k
  const dh = img.naturalHeight * k
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

// WhatsApp Status covers the top (progress bar, name) and the bottom (reply bar) of a 1080 x 1920 picture, so every word
// and logo sits inside this central area; only the plain background reaches the edges.
const PICTURE = { W: 1080, H: 1920, top: 250, bottom: 1650, side: 60 }
// PNG, exactly 1080 x 1920. Tested against a quality-95 JPEG on 11 Nov 2026 (D-060): after the kind of re-encoding WhatsApp
// applies to Status pictures, the PNG source kept about 1.2 dB more detail, and the JPEG was only 7% smaller.
const EXPORT = { type: 'image/png', quality: 1, name: 'whos-on-my-ballot.png' }

/** The same plain placeholder as on the site, for a first-group presidential candidate with no licensed photo. */
function placeholder(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = '#eeeeee'
  g.fillRect(x, y, s, s)
  g.fillStyle = '#c4c4c4'
  g.beginPath()
  g.arc(x + s / 2, y + s * 0.4, s / 6, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.moveTo(x + s * 0.19, y + s * 0.92)
  g.bezierCurveTo(x + s * 0.22, y + s * 0.73, x + s * 0.34, y + s * 0.625, x + s / 2, y + s * 0.625)
  g.bezierCurveTo(x + s * 0.66, y + s * 0.625, x + s * 0.78, y + s * 0.73, x + s * 0.81, y + s * 0.92)
  g.closePath()
  g.fill()
}

/**
 * The share picture: exactly 1080 x 1920, the site's card grid (two columns, three rows), drawn from the full-size logos and
 * photos (never the page's small sprite), loaded only now. Large, heavy text only: the race and date at the top, then each
 * tile's photo (President's first group), logo, acronym and name, then the address and the affiliation line.
 */
async function drawPicture(d: ShareInfo): Promise<File> {
  const { W, H, top, bottom, side } = PICTURE
  const canvas = el('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  const withPhotos = d.tiles.some(t => t[3])
  const [mark, ...imgs] = await Promise.all([loadImage('/icon.svg'), ...d.tiles.flatMap(([p, , , photo]) => [
    loadImage(`/logos/full/${p.toLowerCase()}.webp`),
    photo && photo !== 'placeholder' ? loadImage(photo) : Promise.resolve(null),
  ])])
  g.fillStyle = '#fff'
  g.fillRect(0, 0, W, H)
  g.textBaseline = 'top'
  g.textAlign = 'center'
  // Top: the race and the date, large, on the national green (the band runs to the edge; the words stay inside).
  // One line if it fits at a large size; otherwise two (or more, never cut off).
  let title = fit(g, d.title, 900, 80, 62, W - 2 * side, 1)
  if (title.lines.length > 1) title = fit(g, d.title, 900, 72, 46, W - 2 * side, 2)
  const lh = Math.round(title.size * 1.12)
  const titleY = top + 106
  const band = titleY + title.lines.length * lh + 34
  g.fillStyle = GREEN
  g.fillRect(0, 0, W, band)
  // The site's mark (D-047), large, on a white ring so its green circle shows on the green band.
  if (mark) {
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(W / 2, top + 46, 46, 0, Math.PI * 2)
    g.fill()
    g.drawImage(mark, W / 2 - 42, top + 4, 84, 84)
  }
  g.fillStyle = '#fff'
  g.font = `900 ${title.size}px ${FONT}`
  title.lines.forEach((l, i) => g.fillText(l, W / 2, titleY + i * lh))
  // Middle: the card grid, two by three, the same for every party.
  const gap = 22
  const gridTop = band + 26
  const gridBottom = bottom - 192
  const tw = (W - 2 * side - gap) / 2
  const th = (gridBottom - gridTop - 2 * gap) / 3
  const n = d.tiles.length + (d.more ? 1 : 0)
  for (let k = 0; k < n; k++) {
    const x = side + (k % 2) * (tw + gap)
    const y = gridTop + Math.floor(k / 2) * (th + gap)
    box(g, x, y, tw, th, 26)
    if (k < d.tiles.length) {
      const [party, name, , photo] = d.tiles[k]
      const [logo, pic] = [imgs[2 * k], imgs[2 * k + 1]]
      g.fillStyle = '#fff'
      g.fill()
      g.lineWidth = 4
      g.strokeStyle = '#bdbdbd'
      g.stroke()
      // Room for two lines of name always, so a long name is never cut off; the photo takes what is left.
      const ls = withPhotos ? 60 : 104
      const nameRoom = 2 * 45
      let cy = y + 16
      if (withPhotos) {
        const ps = Math.round(th - 16 - 12 - ls - 10 - nameRoom - 12)
        const px = x + (tw - ps) / 2
        g.save()
        box(g, px, cy, ps, ps, 16)
        g.clip()
        if (pic) g.drawImage(pic, px, cy, ps, ps)
        else if (photo) placeholder(g, px, cy, ps)
        g.restore()
        cy += ps + 12
      }
      else cy += Math.max(0, (th - 16 - ls - 10 - nameRoom - 12 - 60) / 2)
      // The logo beside the acronym, then the name.
      const as = withPhotos ? 52 : 60
      g.font = `900 ${as}px ${FONT}`
      const aw = g.measureText(party).width
      const rowW = ls + 16 + aw
      const lx = x + (tw - rowW) / 2
      if (logo) contain(g, logo, lx, cy, ls, ls)
      g.fillStyle = INK
      g.textAlign = 'left'
      g.fillText(party, lx + ls + 16, cy + (ls - as) / 2 + 2)
      g.textAlign = 'center'
      cy += ls + 10
      const nm = fit(g, name, 800, 40, 24, tw - 32, 2)
      const nlh = Math.round(nm.size * 1.12)
      g.fillStyle = INK
      g.font = `800 ${nm.size}px ${FONT}`
      nm.lines.forEach((l, i) => g.fillText(l, x + tw / 2, cy + i * nlh))
    }
    else {
      g.fillStyle = '#f2f2f2'
      g.fill()
      g.fillStyle = DEEP
      g.font = `900 120px ${FONT}`
      g.fillText(`+${d.more}`, x + tw / 2, y + th / 2 - 100)
      g.font = `800 48px ${FONT}`
      g.fillText(d.more === 1 ? 'more candidate' : 'more candidates', x + tw / 2, y + th / 2 + 40, tw - 30)
    }
  }
  // Bottom: the address, large (WhatsApp can drop the caption), and the affiliation line.
  g.fillStyle = GREEN
  g.font = `900 96px ${FONT}`
  g.fillText('whosonmyballot.ng', W / 2, bottom - 180, W - 2 * side)
  g.fillStyle = '#333'
  g.font = `700 46px ${FONT}`
  g.fillText('Not affiliated with INEC.', W / 2, bottom - 62)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no picture'))), EXPORT.type, EXPORT.quality))
  return new File([blob], EXPORT.name, { type: EXPORT.type })
}

function canShareFiles(): boolean {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }))
  }
  catch {
    return false
  }
}

function setupShare(section: HTMLElement) {
  const d = JSON.parse(section.dataset.share!) as ShareInfo
  // The race's "Share on WhatsApp" button, and the tile in its grid on phones.
  const scope = section.closest('.race') ?? section
  const was = [...scope.querySelectorAll<HTMLAnchorElement>('[data-share-wa]')]
  const sheet = section.querySelector<HTMLButtonElement>('[data-share-sheet]')!
  const status = section.querySelector<HTMLElement>('[data-share-status]')
  const files = canShareFiles()
  const message = `${d.text}\n${d.url}`
  let picture: Promise<File> | null = null
  const getPicture = () => (picture ??= drawPicture(d).catch((e) => {
    picture = null
    throw e
  }))
  // Start drawing as soon as someone reaches for a share button, so the tap shares at once.
  if (files) {
    const warm = () => void getPicture().catch(() => {})
    for (const target of [section, ...was]) {
      for (const type of ['pointerdown', 'focusin', 'mouseenter', 'touchstart']) target.addEventListener(type, warm, { once: true, passive: true })
    }
  }
  const say = (text: string) => {
    if (status) status.textContent = text
  }
  // The phone's share menu with the picture; if that can't happen, `fallback`. Closing the menu is not a failure.
  // On a slow connection the picture may finish after the phone stops counting the tap; then a second tap shares it.
  const withPicture = async (fallback: () => void) => {
    try {
      await navigator.share({ files: [await getPicture()], text: message })
      say('')
    }
    catch (e) {
      const name = (e as DOMException).name
      if (name === 'NotAllowedError') say('Your picture is ready. Tap the share button again to send it.')
      else if (name !== 'AbortError') fallback()
    }
  }
  const linkOnly = () => void navigator.share({ text: message }).catch(() => {})
  if (typeof navigator.share === 'function') sheet.hidden = false
  for (const wa of was) {
    wa.addEventListener('click', (ev) => {
      if (!files) return // the plain link: WhatsApp with the caption and the address
      ev.preventDefault()
      void withPicture(() => { location.href = wa.href })
    })
  }
  sheet.addEventListener('click', () => (files ? void withPicture(linkOnly) : linkOnly()))
}

// ---- Countdown to the next election day: four boxes, ticking each second, in Nigerian time.
const IREV = 'https://inecelectionresults.ng/'
function setupClock(section: HTMLElement) {
  const s = JSON.parse(section.dataset.clock!) as Schedule
  const boxes = section.querySelector<HTMLElement>('.clock-boxes')!
  const staticText = section.querySelector<HTMLElement>('[data-clock-static]')!
  const sr = section.querySelector<HTMLElement>('[data-clock-sr]')!
  const nums = new Map([...section.querySelectorAll<HTMLElement>('[data-unit]')].map(e => [e.dataset.unit!, e]))
  const dates = [...section.querySelectorAll<HTMLElement>('[data-date]')]
  // Built once; later only their text changes, so nothing focused is ever removed (review 4).
  const phase = el('div', '', { class: 'clock-phase' })
  const headline = el('p', '', { class: 'headline' })
  const details = el('div')
  const results = el('p')
  results.append(el('a', 'INEC Result Viewing Portal (IReV)', { href: IREV }))
  phase.append(headline, details, results)
  staticText.replaceWith(phase)
  let lastText = ''
  let lastDays = -1
  const tick = () => {
    const p = phaseAt(new Date(), s)
    const text = p.kind === 'before' ? null : describePhase(p, s)
    const key = JSON.stringify(text)
    if (key !== lastText) {
      lastText = key
      phase.hidden = !text
      if (text) {
        headline.textContent = text.headline
        const ps = text.details.map(t => el('p', t))
        if (details.childElementCount !== ps.length || ps.some((x, i) => details.children[i].textContent !== x.textContent)) details.replaceChildren(...ps)
        results.hidden = !text.showResultsLink
      }
    }
    const next = p.kind === 'before' || p.kind === 'between' ? p.next : null
    boxes.hidden = !next
    for (const li of dates) li.classList.toggle('next', li.dataset.date === next?.date)
    if (!next || (p.kind !== 'before' && p.kind !== 'between')) {
      sr.textContent = ''
      lastDays = -1
      return
    }
    const t = Math.floor(p.msToOpen / 1000)
    const v: Record<string, number> = { days: Math.floor(t / 86400), hours: Math.floor((t % 86400) / 3600), minutes: Math.floor((t % 3600) / 60), seconds: t % 60 }
    for (const [unit, node] of nums) {
      const want = String(v[unit]).padStart(2, '0')
      if (node.textContent !== want) node.textContent = want
    }
    if (v.days !== lastDays) {
      lastDays = v.days
      const left = v.days === 0 ? 'less than a day to go' : `${v.days} ${v.days === 1 ? 'day' : 'days'} to go`
      sr.textContent = `Polls open ${formatDay(next.date)} at ${formatTime(s.open)} WAT: ${left}.`
    }
  }
  tick()
  setInterval(tick, 1000)
}

for (const nav of document.querySelectorAll<HTMLElement>('[data-tabs]')) setupTabs(nav)
for (const box of document.querySelectorAll<HTMLElement>('[data-filter]')) setupFilter(box)
for (const section of document.querySelectorAll<HTMLElement>('[data-share]')) setupShare(section)
for (const section of document.querySelectorAll<HTMLElement>('[data-clock]')) setupClock(section)
