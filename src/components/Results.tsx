import { groupOf, type Race, sheetFor } from '@/lib/data'
import { ELECTION_DAY, noCandidateText } from '@/lib/share'

import { CardPhoto, PartyLogo } from './Candidate'
import { REST_LABEL } from './RaceSection'

/**
 * Results pages before any figure exists (owner feedback, 11 Nov 2026). Nothing here is a number: every row is the
 * candidate in the ballot page's order, with empty space where votes, share and a bar will go. No party colours, and
 * nothing is shaded by who is ahead. When figures come, each will carry its source, its time and its status.
 */
export function waitingLine(r: Race) {
  return `Results will appear here from ${ELECTION_DAY[r.election]}.`
}

export function ResultsTable({ r, label }: { r: Race, label: string }) {
  const fg = groupOf(r)
  const groups = [[fg.label, r.candidates.filter(c => c.display_group === 'first')], [REST_LABEL, r.candidates.filter(c => c.display_group === 'rest')]] as const
  return (
    <table className="results-table">
      <caption className="visually-hidden">{label}</caption>
      <thead>
        <tr>
          <th scope="col">Candidate</th>
          <th scope="col" className="num">Votes</th>
          <th scope="col" className="num">Share</th>
        </tr>
      </thead>
      {groups.map(([g, list]) => list.length > 0 && (
        <tbody key={g}>
          <tr className="rt-group"><th scope="rowgroup" colSpan={3}>{g}</th></tr>
          {list.map(c => (
            <tr key={c.id} data-candidate-id={c.id}>
              <th scope="row" className="rt-cand">
                <span className="rt-pics">
                  <PartyLogo party={c.party} size={40} sheet={sheetFor(r)} />
                  <CardPhoto c={c} size={40} />
                </span>
                <span className="rt-who">
                  <span className="rt-name">{c.candidate.name || noCandidateText(c)}</span>
                  <span className="rt-party">{`${c.party}: ${c.party_name ?? ''}`}</span>
                  <span className="rt-bar" aria-hidden="true"><span /></span>
                </span>
              </th>
              <td className="num"><span className="pending">Awaiting</span></td>
              <td className="num"><span className="pending">Awaiting</span></td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}

/** Where each state sits in the grid map: a simplified layout of Nigeria, north at the top. [column, row] */
export const STATE_GRID: Record<string, [number, number, string]> = {
  'SOKOTO': [1, 0, 'SO'], 'KATSINA': [2, 0, 'KT'], 'KANO': [3, 0, 'KN'], 'JIGAWA': [4, 0, 'JI'], 'YOBE': [5, 0, 'YO'], 'BORNO': [6, 0, 'BO'],
  'KEBBI': [0, 1, 'KE'], 'ZAMFARA': [1, 1, 'ZA'], 'KADUNA': [2, 1, 'KD'], 'BAUCHI': [3, 1, 'BA'], 'GOMBE': [4, 1, 'GO'], 'ADAMAWA': [5, 1, 'AD'],
  'KWARA': [0, 2, 'KW'], 'NIGER': [1, 2, 'NI'], 'FCT': [2, 2, 'FC'], 'NASARAWA': [3, 2, 'NA'], 'PLATEAU': [4, 2, 'PL'], 'TARABA': [5, 2, 'TA'],
  'OYO': [0, 3, 'OY'], 'OSUN': [1, 3, 'OS'], 'KOGI': [2, 3, 'KO'], 'BENUE': [3, 3, 'BE'],
  'OGUN': [0, 4, 'OG'], 'EKITI': [1, 4, 'EK'], 'EDO': [2, 4, 'ED'], 'ENUGU': [3, 4, 'EN'], 'EBONYI': [4, 4, 'EB'], 'CROSS RIVER': [5, 4, 'CR'],
  'LAGOS': [0, 5, 'LA'], 'ONDO': [1, 5, 'ON'], 'DELTA': [2, 5, 'DE'], 'ANAMBRA': [3, 5, 'AN'], 'ABIA': [4, 5, 'AB'], 'AKWA IBOM': [5, 5, 'AK'],
  'BAYELSA': [2, 6, 'BY'], 'IMO': [3, 6, 'IM'], 'RIVERS': [4, 6, 'RI'],
}

/** Every state as a tile: reported or awaiting, nothing else. Nothing yet has reported. */
export function StateMap({ names }: { names: { code: string, name: string }[] }) {
  return (
    <ul className="state-map" aria-label="States: reported or awaiting">
      {names.map((s) => {
        const key = s.name === 'FEDERAL CAPITAL TERRITORY' ? 'FCT' : s.name
        const [col, row, abbr] = STATE_GRID[key]
        return (
          <li key={s.code} className={`sm-c${col} sm-r${row}`} data-state={s.code} data-status="awaiting">
            <span aria-hidden="true">{abbr}</span>
            <span className="visually-hidden">{`${s.name}: awaiting`}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function MapKey() {
  return (
    <ul className="map-key" aria-label="Key">
      <li><span className="key-box reported" aria-hidden="true">✓</span> Reported</li>
      <li><span className="key-box" aria-hidden="true" /> Awaiting</li>
    </ul>
  )
}
