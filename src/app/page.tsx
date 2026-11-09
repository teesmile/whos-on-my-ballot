import { states } from '@/lib/data'

export default function Home() {
  return (
    <>
      <h1>Where will you vote?</h1>
      <p className="lead">
        Your ballot depends on the polling unit where you are registered. Find it and see every race and every candidate on your ballot for
        {' '}
        <strong>16 January 2027</strong>
        : President, Senate and House of Representatives.
      </p>
      <p>We never ask for your name or any personal details, and we don’t look you up anywhere.</p>

      <section aria-labelledby="by-code" className="by-code">
        <h2 id="by-code">Use the code on your voter card</h2>
        <form className="lookup" data-lookup="code" hidden>
          <label htmlFor="code">
            Delimitation code from your PVC
            <span className="hint">Four numbers, like 24/15/03/012</span>
          </label>
          <input id="code" name="code" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} />
          <button type="submit">Find my polling unit</button>
          <div className="result" role="status" aria-live="polite" />
        </form>
        <noscript>
          <p>Finding by code needs JavaScript. Choose your state below and browse to your polling unit instead.</p>
        </noscript>
      </section>

      <section aria-labelledby="by-state">
        <h2 id="by-state">Search or browse by state</h2>
        <p>Choose your state, then search for your polling unit or a landmark near it, or go through your LGA and ward.</p>
        <ul className="link-list columns">
          {states().map(s => (
            <li key={s.code}><a href={`/state/${s.code}/`}>{s.name}</a></li>
          ))}
        </ul>
      </section>
    </>
  )
}
