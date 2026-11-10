/** Where the visitor is on the guided path: state, LGA, ward, polling unit. */
const STEPS = ['State', 'LGA', 'Ward', 'Polling unit']

export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="progress" aria-label={`Step ${current} of 4`}>
      {STEPS.map((s, i) => (
        <li key={s} className={i + 1 < current ? 'done' : undefined} aria-current={i + 1 === current ? 'step' : undefined}>{s}</li>
      ))}
    </ol>
  )
}
