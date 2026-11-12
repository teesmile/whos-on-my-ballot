import type { Metadata } from 'next'

import { CivicNote } from '@/components/CivicNote'
import { Countdown } from '@/components/Countdown'
import { HeroArt } from '@/components/HeroArt'
import { JsonLd } from '@/components/JsonLd'
import { Steps } from '@/components/Steps'
import { states } from '@/lib/data'
import { homeGraph, pageMeta } from '@/lib/seo'
import { CODE_EXAMPLE, SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

export const metadata: Metadata = pageMeta({ title: SITE_NAME, path: '/', description: SITE_DESCRIPTION })

export default function Home() {
  return (
    <>
      <JsonLd data={homeGraph()} />
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Who’s on your ballot in 2027?</h1>
        <HeroArt />
        <p className="hero-line">Every race and every candidate at your polling unit, from INEC’s official lists.</p>
        <div className="hero-action">
          <h2 className="action-title">Where will you vote?</h2>
          <Steps current={1} />
          <p className="action-buttons">
            <a className="btn btn-big" href="#by-state">Pick your state</a>
            <a className="btn" href="#by-landmark">Search by a landmark</a>
          </p>
        </div>
        <Countdown headingLevel={2} />
        <section aria-labelledby="results-card" className="panel results-card">
          <h2 id="results-card">Results</h2>
          <p>
            Results for President will appear on this site from 16 January 2027, and for Governor from 6 February 2027. Every figure will show
            its source and the time it was published.
          </p>
          <p className="action-buttons"><a className="btn" href="/results/">Go to the results page</a></p>
        </section>
      </section>

      <div className="guide">
        <section aria-labelledby="by-state" className="panel">
          <h2 id="by-state">Pick your state</h2>
          <p className="panel-intro">Then your LGA, your ward and your polling unit. Each step is one tap.</p>
          <ul className="link-list tiles">
            {states().map(s => (
              <li key={s.code}><a href={`/state/${s.code}/`}>{s.name}</a></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="by-landmark" className="panel by-search">
          <h2 id="by-landmark">Or search by a landmark</h2>
          <p className="panel-intro">A school, market or church near where you vote, or the polling unit’s name.</p>
          <form className="lookup" data-lookup="search" hidden>
            <label htmlFor="home-state">Your state</label>
            <select id="home-state" name="state" defaultValue="">
              <option value="" disabled>Choose your state</option>
              {states().map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <label htmlFor="home-lga">Your LGA</label>
            <select id="home-lga" name="lga" defaultValue="" disabled>
              <option value="">Choose your state first</option>
            </select>
            <label htmlFor="home-q">Landmark or polling unit name</label>
            <input id="home-q" name="q" type="search" autoComplete="off" spellCheck={false} />
            <button type="submit">Search</button>
            <div className="result" role="status" aria-live="polite" />
          </form>
          <noscript>
            <p>Searching needs JavaScript. Pick your state and go through your LGA and ward instead.</p>
          </noscript>
        </section>
      </div>

      <section aria-labelledby="by-code" className="panel by-code">
        <h2 id="by-code">Have your voter’s card? Type its code.</h2>
        <form className="lookup" data-lookup="code" hidden>
          <label htmlFor="code">
            Code on your voter’s card
            <span className="hint">
              {`Like ${CODE_EXAMPLE}, with or without the dashes`}
            </span>
          </label>
          <p className="hint" id="code-parts">State, LGA and ward, then the last three digits for your polling unit.</p>
          <input id="code" name="code" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} aria-describedby="code-parts" />
          <button type="submit">Find my polling unit</button>
          <div className="result" role="status" aria-live="polite" />
        </form>
        <noscript>
          <p>Finding by code needs JavaScript. Pick your state above and go through your LGA and ward instead.</p>
        </noscript>
      </section>

      <p className="quiet">We never ask for your name or any personal details, and we don’t look you up anywhere.</p>
      <p className="go"><a className="btn" href="/about/find-your-polling-unit/">How to find your polling unit</a></p>
      <CivicNote />
    </>
  )
}
