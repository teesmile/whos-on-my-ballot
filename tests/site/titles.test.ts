import { describe, expect, test } from 'vitest'

import { allCandidates, allRaces } from '@/lib/data'
import { candidateMetaDescription, candidateMetaTitle, placeCase, raceMetaDescription, raceMetaTitle } from '@/lib/titles'

// Search titles and descriptions (owner, 25 Nov 2026, D-100).
describe('race and candidate titles', () => {
  const races = allRaces()
  const cands = allCandidates()

  test('every race title and every candidate title is unique', () => {
    const rt = races.map(r => raceMetaTitle(r))
    const ct = cands.map(({ race, c }) => candidateMetaTitle(race, c))
    expect(new Set(rt).size).toBe(rt.length)
    expect(new Set(ct).size).toBe(ct.length)
  })

  test('race titles follow the owner\'s pattern for each office', () => {
    const pattern = {
      president: /^2027 presidential candidates in Nigeria - full list$/,
      governor: /^([A-Z][a-z]+( [A-Z][a-z]+)?) governorship candidates 2027 - full list$/,
      senate: / senatorial district candidates 2027( - [A-Z][A-Za-z ]+)?$/,
      house: / federal constituency candidates 2027( - [A-Z][A-Za-z ]+)?$/,
      state_assembly: / state constituency candidates 2027( - [A-Z][A-Za-z ]+ Assembly)?$/,
    }
    for (const r of races) expect(raceMetaTitle(r), r.id).toMatch(pattern[r.office])
  })

  test('a race title drops its " - State" ending only when it is longer than about 65 characters', () => {
    for (const r of races.filter(r => r.office === 'senate' || r.office === 'house' || r.office === 'state_assembly')) {
      const t = raceMetaTitle(r)
      if (!/ - [A-Z]/.test(t)) expect(`${t} - ${placeCase(r.state!)}${r.office === 'state_assembly' ? ' Assembly' : ''}`.length, r.id).toBeGreaterThan(65)
    }
  })

  test('candidate names stay exactly as INEC prints them; states are in title case', () => {
    for (const { race, c } of cands.filter(x => x.c.candidate.name).slice(0, 4000)) {
      expect(candidateMetaTitle(race, c).startsWith(`${c.candidate.name} (${c.party}) - `), c.id).toBe(true)
      expect(candidateMetaDescription(race, c).startsWith(`${c.candidate.name} is the `), c.id).toBe(true)
    }
    const ak = races.find(r => r.id === 'feb-2027-governor-akwa-ibom')!
    expect(raceMetaTitle(ak)).toBe('Akwa Ibom governorship candidates 2027 - full list')
    expect(raceMetaDescription(ak)).toMatch(/^All \d+ candidates for Governor of Akwa Ibom State on 6 February 2027, as listed by INEC, with their parties and photos where available\.$/)
  })

  test('place names: title case, INEC spacing closed up, Roman numerals kept', () => {
    expect(placeCase('SAKI EAST AND ATISBO')).toBe('Saki East and Atisbo')
    expect(placeCase('IKOLE I')).toBe('Ikole I')
    expect(placeCase('AKWA IBOM')).toBe('Akwa Ibom')
    expect(placeCase('FCT')).toBe('FCT')
    expect(placeCase('Isiala Ngwa North /Isiala Ngwa South')).toBe('Isiala Ngwa North /Isiala Ngwa South')
    const jg = races.find(r => r.id === 'jan-2027-senate-jigawa-jigawa-south-west')!
    expect(raceMetaTitle(jg)).toBe('Jigawa South-West senatorial district candidates 2027 - Jigawa')
  })
})
