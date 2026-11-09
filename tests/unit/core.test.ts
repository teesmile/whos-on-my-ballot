import { describe, expect, it } from 'vitest'

import {
  ballotPath, codeFromHash, findByCode, parseDelimitationCode, puHash, searchLga, type StateSearchData,
} from '@/lib/core'

describe('parseDelimitationCode (mirrors the pipeline parser)', () => {
  it.each([
    ['24/15/03/012', '24/15/03/012'], ['24-15-03-012', '24/15/03/012'], ['24 15 03 012', '24/15/03/012'],
    ['24-15-3-12', '24/15/03/012'], [' 01/01/01/001 ', '01/01/01/001'], ['37/06/10/045', '37/06/10/045'], ['24.15.03.012', '24/15/03/012'],
  ])('%s -> %s', (text, code) => expect(parseDelimitationCode(text)).toBe(code))

  it.each(['', '24/15/03', '38/01/01/001', '00/01/01/001', '24/15/03/0', '24/15/03/1234', 'AB/15/03/012', '24/15/03/012/9', '24151503012', '24//15/03/012x'])(
    'rejects %j', text => expect(parseDelimitationCode(text)).toBeNull(),
  )
})

describe('ballot paths and fragments', () => {
  it('builds a readable, sorted path', () => {
    expect(ballotPath('LAGOS', ['jan-2027-house-lagos-surulere-ii', 'jan-2027-house-lagos-surulere-i'], ['jan-2027-senate-lagos-lagos-central']))
      .toBe('/ballot/lagos/surulere-i-or-surulere-ii--lagos-central/')
    expect(ballotPath('AKWA IBOM', ['jan-2027-house-akwa-ibom-uyo'], ['jan-2027-senate-akwa-ibom-akwa-ibom-north-east']))
      .toBe('/ballot/akwa-ibom/uyo--akwa-ibom-north-east/')
  })

  it('refuses races from another state or an empty ballot', () => {
    expect(() => ballotPath('ABIA', ['jan-2027-house-imo-x'], ['jan-2027-senate-abia-y'])).toThrow()
    expect(() => ballotPath('ABIA', [], ['jan-2027-senate-abia-y'])).toThrow()
  })

  it('round-trips the polling unit through the fragment', () => {
    expect(puHash('24/15/03/012')).toBe('#pu-24-15-03-012')
    expect(codeFromHash('#pu-24-15-03-012')).toBe('24/15/03/012')
    expect(codeFromHash('#pu-24-15-03')).toBeNull()
    expect(codeFromHash('#race-x')).toBeNull()
  })
})

const DATA: StateSearchData = {
  code: '01',
  name: 'ABIA',
  lgas: [
    ['01', 'ABA NORTH', [
      ['01', 'EZIAMA', '/ballot/abia/a--b/', [
        ['001', 'RAILWAY QUARTERS - RAILWAY QUARTERS I'],
        ['005', 'ABIA POLY - ABIA POLY I'],
        ['011', 'EZIAMA HIGH SCHOOL - EZIAMA HIGH SCHOOL I'],
      ]],
      ['09', 'ARIARIA MARKET', '/ballot/abia/a--b/', [
        ['001', 'ARIARIA MARKET SQUARE'],
        ['002', 'ST. MICHAEL\'S CATHOLIC CHURCH'],
        ['003', 'CENTRAL PRY SCH, OKPU UMUOBO'],
      ]],
    ]],
    ['02', 'ABA SOUTH', [['01', 'ASA', '/ballot/abia/c--b/', [['001', 'ABIA POLY ANNEX']]]]],
  ],
}

describe('findByCode', () => {
  it('finds a unit and its ballot', () => {
    expect(findByCode(DATA, '01/01/09/002')).toMatchObject({ name: 'ST. MICHAEL\'S CATHOLIC CHURCH', ward: 'ARIARIA MARKET', ballotPath: '/ballot/abia/a--b/' })
  })
  it('says not found instead of guessing', () => {
    expect(findByCode(DATA, '01/01/09/004')).toBeNull()
    expect(findByCode(DATA, '02/01/09/002')).toBeNull()
  })
})

describe('searchLga', () => {
  const top = (q: string, lga = '01') => searchLga(DATA, lga, q).map(h => h.code)

  it('exact name first', () => expect(top('Eziama High School')[0]).toBe('01/01/01/011'))
  it('landmark substring', () => expect(top('poly')).toEqual(['01/01/01/005']))
  it('landmark matched through the ward name', () => expect(top('ariaria')[0]).toBe('01/01/09/001'))
  it('tolerates typos', () => expect(top('railwy quaters')[0]).toBe('01/01/01/001'))
  it('punctuation and case do not matter', () => expect(top('st michaels church')[0]).toBe('01/01/09/002'))
  it('stays within the chosen LGA', () => {
    expect(top('poly', '02')).toEqual(['01/02/01/001'])
    expect(top('railway', '02')).toEqual([])
  })
  it('INEC abbreviations match full words', () => expect(top('central primary school')[0]).toBe('01/01/09/003'))
  it('abbreviation needs the same first letter', () => expect(top('ary sch')).toEqual([]))
  it('every word must match something', () => expect(top('poly zzzz')).toEqual([]))
  it('empty query returns nothing', () => expect(top('   ')).toEqual([]))
  it('an exact unit name beats units that only share the ward name', () => {
    const ward: StateSearchData = { code: '01', name: 'ABIA', lgas: [['10', 'OHAFIA', [['08', 'OHAFOR OHAFIA', '/b/', [
      ['001', 'ATAN ASAGA - ATAN HALL'], ['002', 'UMA UKPAI PRI. SCH. I'], ['003', 'NDI MBA'], ['004', 'NDI AJI'],
      ['005', 'NDI AGWU'], ['006', 'NDI AWAM'], ['008', 'OHAFOR OHAFIA'],
    ]]]]] }
    expect(searchLga(ward, '10', 'Ohafor Ohafia')[0].code).toBe('01/10/08/008')
  })
  it('own-name matches outrank ward-name matches', () => expect(top('ariaria square')[0]).toBe('01/01/09/001'))
  it('returns at most five', () => expect(searchLga(DATA, '01', 'a').length).toBeLessThanOrEqual(5))
})
