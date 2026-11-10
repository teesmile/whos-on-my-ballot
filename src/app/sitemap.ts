import type { MetadataRoute } from 'next'

import { CONTENT_DATES } from '@/lib/content-dates'
import { allCandidates, ballots, febBallots, geographyContentDate, presidentialRace, race, raceContentDate, stateGeo, states } from '@/lib/data'
import { absolute } from '@/lib/seo'
import { candidatePath } from '@/lib/site'

// Every indexable page with its content date (D-032). Share cards, data files and the 404 page are left out.
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const geo = geographyContentDate()
  const latest = (d: string[]) => [...d].sort().at(-1)!
  const entry = (path: string, lastModified: string) => ({ url: absolute(path), lastModified })
  const out = [
    entry('/', CONTENT_DATES.home),
    entry('/about/', CONTENT_DATES.about),
    entry('/about/find-your-polling-unit/', CONTENT_DATES['about/find-your-polling-unit']),
    entry('/about/state-assembly-wards/', CONTENT_DATES['about/state-assembly-wards']),
    entry('/election-day/', CONTENT_DATES['election-day']),
    entry('/corrections/', CONTENT_DATES.corrections),
  ]
  for (const s of states()) {
    const st = stateGeo(s.code)
    out.push(entry(`/state/${st.code}/`, geo))
    for (const l of st.lgas) {
      out.push(entry(`/lga/${l.code.replace('/', '-')}/`, geo))
      for (const w of l.wards) out.push(entry(`/ward/${w.code.replaceAll('/', '-')}/`, geo))
    }
  }
  const pres = raceContentDate(presidentialRace())
  for (const b of ballots()) out.push(entry(b.path, latest([pres, ...[...b.house, ...b.senate].map(id => raceContentDate(race(id)))])))
  for (const b of febBallots()) {
    const ids = [...(b.governor ? [b.governor] : []), ...b.sha]
    out.push(entry(b.path, ids.length ? latest(ids.map(id => raceContentDate(race(id)))) : geo))
  }
  for (const { race: r, c } of allCandidates()) out.push(entry(candidatePath(c.id), raceContentDate(r)))
  return out
}
