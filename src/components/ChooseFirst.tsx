/**
 * Shown at the top of every ballot until the visitor's own polling unit is confirmed (owner feedback, 11 Nov 2026): someone
 * who arrives on a ballot without having picked their place (a link, a search engine) is told whose ballot it is and asked
 * to choose their own first. With a polling unit in the address, the page script replaces this with that polling unit.
 */
export function ChooseFirst({ election, state, area }: { election: 'jan' | 'feb', state: { code: string, name: string }, area: string }) {
  return (
    <div className="pu-confirmed choose-first" data-lookup="confirm" data-election={election} data-state={state.code} role="status" aria-live="polite">
      <p>
        <strong>Did you choose this place?</strong>
        {` This ballot is for ${area}. If it isn’t where you vote, choose your state first.`}
      </p>
      <p className="choose-first-go"><a className="btn" href="/#by-state">Choose your state</a></p>
    </div>
  )
}
