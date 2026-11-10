/**
 * The site's only script (decision D-022). It enhances three static forms:
 *   [data-lookup="code"]    find a polling unit from the PVC delimitation code
 *   [data-lookup="search"]  find a polling unit by name or nearby landmark within one LGA (on the home page the
 *                           visitor picks the state too, and its LGAs are filled in from that state's file)
 *   [data-lookup="confirm"] on a ballot page, name the polling unit chosen (from the URL fragment) and link its
 *                           ballot for the other election day
 *   [data-copy]             copy a page's link to the clipboard
 *   [data-countdown]        election-day schedule: where we are in it, updated each minute (no live announcements)
 * Privacy (D-015): the only network request is GET /data/pu/<SS>.json, a fixed per-state file. What the visitor
 * types is matched in memory, never sent, never stored, and never put in a URL (fragments aren't sent to servers).
 */
import { describePhase, phaseAt, type Schedule } from '../lib/election'
import {
  cardCode,
  codeFromHash,
  findByCode,
  type FoundPollingUnit,
  parseDelimitationCode,
  puHash,
  searchLga,
  type StateSearchData,
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
  else if (node.dataset.lookup === 'confirm') void setupConfirm(node)
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

const IREV = 'https://inecelectionresults.ng/'
for (const box of document.querySelectorAll<HTMLElement>('[data-countdown]')) {
  const schedule = JSON.parse(box.dataset.countdown!) as Schedule
  // Build the parts once and only change text that changed, so nothing focused is ever removed (review 4).
  const headline = el('p', '', { class: 'headline' })
  const details = el('div')
  const results = el('p')
  results.append(el('a', 'INEC Result Viewing Portal (IReV)', { href: IREV }))
  box.replaceChildren(headline, details, results)
  let last = ''
  const render = () => {
    const text = describePhase(phaseAt(new Date(), schedule), schedule)
    const key = JSON.stringify(text)
    if (key === last) return
    last = key
    headline.textContent = text.headline
    const ps = text.details.map(d => el('p', d))
    if (details.childElementCount !== ps.length || ps.some((p, i) => details.children[i].textContent !== p.textContent))
      details.replaceChildren(...ps)
    results.hidden = !text.showResultsLink
  }
  render()
  setInterval(render, 30_000)
}
