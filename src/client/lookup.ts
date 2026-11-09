/**
 * The site's only script (decision D-022). It enhances three static forms:
 *   [data-lookup="code"]    find a polling unit from the PVC delimitation code
 *   [data-lookup="search"]  find a polling unit by name or nearby landmark within one LGA
 *   [data-lookup="confirm"] on a ballot page, name the polling unit chosen (from the URL fragment)
 * Privacy (D-015): the only network request is GET /data/pu/<SS>.json, a fixed per-state file. What the visitor
 * types is matched in memory, never sent, never stored, and never put in a URL (fragments aren't sent to servers).
 */
import {
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
    p = fetch(`/data/pu/${code}.json`, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then((r) => {
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
  a.append(el('strong', pu.name), document.createTextNode(` · ${pu.ward} ward, ${pu.lga} · `), el('span', pu.code, { class: 'code' }))
  return a
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
      show(result, el('p', 'That isn’t a delimitation code. It has four numbers, like 24/15/03/012.'))
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
      show(result, el('p', `We couldn’t find ${code} in INEC’s list of polling units. Check the code on your card, or choose your state below.`))
      return
    }
    const ul = el('ul')
    ul.append(el('li'))
    ul.firstChild!.appendChild(puLink(pu))
    show(result, el('p', 'Is this your polling unit? Choose it to see your ballot.'), ul)
  })
}

function setupSearch(form: HTMLFormElement) {
  const state = form.dataset.state!
  const lga = form.querySelector('select')!
  const input = form.querySelector('input')!
  const result = form.querySelector('.result')!
  const begin = latestOnly()
  form.hidden = false
  const prefetch = () => void stateData(state).catch(() => {})
  lga.addEventListener('change', prefetch, { once: true })
  input.addEventListener('focus', prefetch, { once: true })
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const current = begin()
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
    for (const h of hits) {
      const li = el('li')
      li.append(puLink(h))
      ul.append(li)
    }
    show(result, el('p', `Is one of these your polling unit? ${hits.length === 1 ? 'Choose it' : 'Choose yours'} to see your ballot.`), ul)
  })
}

async function setupConfirm(box: HTMLElement) {
  const code = codeFromHash(location.hash)
  if (!code || code.slice(0, 2) !== box.dataset.state) return
  try {
    const pu = findByCode(await stateData(code.slice(0, 2)), code)
    if (!pu) return
    const here = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`
    box.replaceChildren(
      el('p', `Your polling unit: ${pu.name}, ${pu.ward} ward, ${pu.lga} LGA (${pu.code}).`),
      ...(pu.ballotPath === here ? [] : [el('p', 'This polling unit belongs to a different ballot. Follow the link below.')]),
    )
    if (pu.ballotPath !== here) box.append(puLink(pu))
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
