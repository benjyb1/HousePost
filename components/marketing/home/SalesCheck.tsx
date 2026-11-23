'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './home.module.css'

/*
  Section 5: try it yourself. The postcode box sits inside the sentence and
  the sentence's last word is the button. It asks the real sales lookup
  (/api/houses-sold, 5 miles) and applies the 44% from Zoopla's 2025 survey.
  The count is for the latest month of figures we hold, so the copy says
  "recent sales" rather than naming a month of sale.
*/

const RENOVATE_SHARE = 0.44
const RADIUS = 5
const EXAMPLE = 'GU7 1AA'

type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'done'; postcode: string; count: number; capped: boolean }
  | { state: 'error'; message: string }

export function SalesCheck() {
  const [postcode, setPostcode] = useState(EXAMPLE)
  const [result, setResult] = useState<Result>({ state: 'idle' })
  const sectionRef = useRef<HTMLElement>(null)
  const askedRef = useRef(false)

  const lookup = async (raw: string) => {
    const value = raw.trim()
    if (!value) {
      setResult({ state: 'error', message: 'Type a full postcode first, such as SW4 7AA.' })
      return
    }
    setResult({ state: 'loading' })
    try {
      const res = await fetch(`/api/houses-sold?postcode=${encodeURIComponent(value)}&radius=${RADIUS}`)
      const data = await res.json()
      if (data.ok) {
        setResult({ state: 'done', postcode: data.postcode, count: data.count, capped: data.capped })
      } else if (data.code === 'invalid_postcode') {
        setResult({ state: 'error', message: "We couldn't find that postcode. Use the full postcode, such as SW4 7AA." })
      } else {
        setResult({ state: 'error', message: "Sales figures aren't available right now. Try again in a minute." })
      }
    } catch {
      setResult({ state: 'error', message: "Sales figures aren't available right now. Try again in a minute." })
    }
  }

  // show a real example once the section comes into view
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !askedRef.current) {
          askedRef.current = true
          void lookup(EXAMPLE)
          io.disconnect()
        }
      },
      { rootMargin: '200px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="check" className={`${styles.wrap} ${styles.check}`} aria-labelledby="check-title">
      <h2 id="check-title" className={styles.howTitle}>
        Try it yourself
      </h2>
      <form
        className={styles.checkForm}
        onSubmit={(e) => {
          e.preventDefault()
          void lookup(postcode)
        }}
      >
        <span>Homes sold near</span>
        <label htmlFor="check-postcode" className={styles.srOnly}>
          Your postcode
        </label>
        <input
          id="check-postcode"
          className={styles.checkInput}
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="Postcode"
          autoComplete="postal-code"
          spellCheck={false}
          maxLength={9}
        />
        <button type="submit" className={styles.checkButton} disabled={result.state === 'loading'}>
          Check
        </button>
      </form>

      <p className={styles.checkResult} aria-live="polite">
        {result.state === 'loading' && 'Checking the latest sales…'}
        {result.state === 'error' && result.message}
        {result.state === 'idle' && 'Put in the postcode of your office or workshop.'}
        {result.state === 'done' &&
          (result.count === 0 ? (
            <>No homes within {RADIUS} miles of {result.postcode} sold in the latest month of figures. Try a postcode nearer a town.</>
          ) : (
            <>
              <b>
                {result.capped ? 'At least ' : ''}
                {result.count.toLocaleString('en-GB')}
              </b>{' '}
              homes within {RADIUS} miles of <b>{result.postcode}</b> sold in the latest month of figures.
              We estimate around <b>{Math.round(result.count * RENOVATE_SHARE).toLocaleString('en-GB')}</b> of
              their new owners will renovate in their first year.
            </>
          ))}
      </p>
      <p className={styles.checkNote}>
        Estimate based on Zoopla research with Opinium (2025): 44% of buyers renovated within the first
        year of moving in.
      </p>
    </section>
  )
}
