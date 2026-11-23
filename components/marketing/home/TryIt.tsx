'use client'

import { useState } from 'react'
import styles from './home.module.css'

// Zoopla research with Opinium, February 2025: 44% of buyers renovated within
// their first year of moving in.
const RENOVATE_SHARE = 0.44
const RADIUS = 5

type Result = { postcode: string; count: number; capped: boolean }

/** Freddie's "Try it yourself": a postcode in, recent sales nearby and the 44% estimate out. */
export function TryIt() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  async function check(e: React.FormEvent) {
    e.preventDefault()
    const raw = value.toUpperCase().replace(/\s+/g, '')
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(raw)) {
      setError(/^[A-Z]{1,2}\d[A-Z\d]?$/.test(raw) ? 'That is the first half of a postcode. Add the rest, like GU7 1AA.' : 'Enter a full postcode, like GU7 1AA.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/houses-sold?postcode=${encodeURIComponent(raw)}&radius=${RADIUS}`)
      const data = await res.json()
      if (!data.ok) {
        setResult(null)
        setError(data.code === 'no_data' ? 'Sales data is being updated. Try again in a little while.' : data.error || 'We could not check that postcode.')
        return
      }
      setResult({ postcode: data.postcode, count: data.count, capped: !!data.capped })
      setValue(data.postcode)
    } catch {
      setError('We could not check that postcode just now. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  const est = result ? Math.round(result.count * RENOVATE_SHARE) : 0

  return (
    <>
      <form className={styles.tryForm} onSubmit={check} noValidate>
        <div>
          <label htmlFor="tryPostcode">Your office postcode</label>
          <input
            id="tryPostcode"
            className={styles.tryInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="postal-code"
            placeholder="e.g. GU7 1AA"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'tryError' : undefined}
          />
        </div>
        <button className={styles.btn} type="submit" disabled={busy}>{busy ? 'Checking…' : 'Check'}</button>
      </form>
      {error && <p className={styles.tryErr} id="tryError" role="alert">{error}</p>}
      <p className={styles.tryOut} aria-live="polite">
        {result && result.count > 0 && (
          <>
            <b>{result.capped ? 'More than ' : ''}{result.count.toLocaleString('en-GB')} homes</b> have sold within {RADIUS} miles of {result.postcode} recently.
            {' '}We estimate around <b>{est.toLocaleString('en-GB')}</b> of their new owners will renovate in their first year.
          </>
        )}
        {result && result.count === 0 && <>We couldn&rsquo;t find recent sales within {RADIUS} miles of {result.postcode}. A postcode nearer a town will show more.</>}
      </p>
    </>
  )
}
