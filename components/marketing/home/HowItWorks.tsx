'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './home.module.css'

/*
  Section 4: how it works. Three statements on the left; on the right a piece
  of the real app that changes to match whichever statement is in view:
  your area, then this month's homes with three picked, then Tracking.
  Inside each state a little of it plays out (ticks, the counter, the
  statuses) so it reads like the demo Freddie asked for.
*/

const STEPS = [
  {
    title: 'First, tell us where you work.',
    body: "Your postcode, how far you'll travel and the kind of homes you want. Change them whenever you like.",
  },
  {
    title: 'Then pick the homes worth a card.',
    body: 'New sales near you arrive every month. Tick the ones you want, use one of our designs or your own, and send.',
  },
  {
    title: 'Then follow each card to the door.',
    body: 'Every card shows Scheduled, Printing, Dispatched and Delivered as it goes. You can cancel within 15 minutes of sending.',
  },
]

const HOMES = [
  { street: '14 Larkfield Road', area: 'GU7 1QL · Semi-detached', price: '£685,000' },
  { street: '5 Mill Pond Row', area: 'GU7 1HY · Terraced', price: '£540,000' },
  { street: '27 Wey Terrace', area: 'GU7 1ER · Terraced', price: '£512,000' },
  { street: '9 Orchard Close', area: 'GU7 2BN · Detached', price: '£1,240,000' },
  { street: '31 Hillside Gardens', area: 'GU7 3DS · Semi-detached', price: '£725,000' },
]
const PICKED = [0, 2, 3]
const STATUS = ['Scheduled', 'Printing', 'Dispatched', 'Delivered']

export function HowItWorks() {
  const [active, setActive] = useState(0)
  const [tick, setTick] = useState(0) // how far the current state has played
  const refs = useRef<(HTMLDivElement | null)[]>([])

  // Wide screens: the statement in the middle of the screen drives the app.
  // Phones: nothing is pinned; the app plays the three states on a loop.
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 900px)')
    let io: IntersectionObserver | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const STATE_MS = [3600, 3800, 5400]

    const start = () => {
      io?.disconnect()
      clearTimeout(timer)
      if (narrow.matches) {
        let i = 0
        const next = () => {
          timer = setTimeout(() => {
            i = (i + 1) % STEPS.length
            setActive(i)
            next()
          }, STATE_MS[i])
        }
        next()
      } else {
        io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step))
            }
          },
          { rootMargin: '-45% 0px -45% 0px' }
        )
        refs.current.forEach((el) => el && io!.observe(el))
      }
    }
    start()
    narrow.addEventListener('change', start)
    return () => {
      narrow.removeEventListener('change', start)
      io?.disconnect()
      clearTimeout(timer)
    }
  }, [])

  // play the state through: ticks in "pick", statuses in "track"
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let n = 0
    const max = active === 1 ? PICKED.length : active === 2 ? STATUS.length : 0
    const id = setInterval(
      () => {
        n = reduced ? max : Math.min(max, n + 1)
        setTick(n)
        if (n >= max) clearInterval(id)
      },
      reduced ? 0 : active === 2 ? 900 : 650
    )
    return () => {
      clearInterval(id)
      setTick(0)
    }
  }, [active])

  const picked = active === 1 ? tick : 0

  return (
    <section id="how" className={`${styles.wrap} ${styles.how}`} aria-labelledby="how-title">
      <div>
        <h2 id="how-title" className={styles.howTitle}>
          How it works
        </h2>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <div
                ref={(el) => {
                  refs.current[i] = el
                }}
                data-step={i}
                className={`${styles.statement} ${active === i ? styles.statementOn : ''}`}
              >
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.stageCol}>
        <div className={styles.stage}>
          <div className={styles.ui} data-ui="">
            <div className={styles.uiBar}>
              <b>Housepost</b>
              <span className={active === 2 ? '' : styles.uiTabOn}>Home</span>
              <span>Designs</span>
              <span className={active === 2 ? styles.uiTabOn : ''}>Tracking</span>
            </div>

            {active === 0 && (
              <div key="area" className={`${styles.uiPanel} ${styles.uiFlip}`}>
                <p className={styles.uiH}>Your area</p>
                <div className={styles.uiField}>
                  <span>Office postcode</span>
                  <span className={styles.uiInput}>GU7 1AA</span>
                </div>
                <div className={styles.uiField}>
                  <span>How far</span>
                  <span style={{ display: 'grid', gap: 8 }}>
                    <span className={styles.uiSlider}>
                      <i />
                    </span>
                    <span style={{ fontWeight: 600 }}>3 miles</span>
                  </span>
                </div>
                <div className={styles.uiField}>
                  <span>Sale price</span>
                  <span style={{ fontWeight: 600 }}>£450,000 to £1,500,000</span>
                </div>
                <div className={styles.uiField}>
                  <span>Homes</span>
                  <span className={styles.uiChips}>
                    <span className={styles.uiChipOn}>Detached</span>
                    <span className={styles.uiChipOn}>Semi</span>
                    <span className={styles.uiChipOn}>Terraced</span>
                    <span>Flat</span>
                  </span>
                </div>
                <p className={styles.uiSaved}>Saved. We&apos;ll use these every month.</p>
              </div>
            )}

            {active === 1 && (
              <div key="pick" className={`${styles.uiPanel} ${styles.uiFlip}`}>
                <p className={styles.uiH}>New this month</p>
                {HOMES.map((h, i) => {
                  const on = PICKED.indexOf(i) > -1 && PICKED.indexOf(i) < picked
                  return (
                    <div key={h.street} className={`${styles.uiRow} ${on ? styles.uiRowOn : ''}`}>
                      <span className={styles.uiCheck} />
                      <span>
                        <b>{h.street}</b>
                        <small>{h.area}</small>
                      </span>
                      <span className={styles.uiPrice}>{h.price}</span>
                    </div>
                  )
                })}
                <div className={styles.uiSend}>
                  <span>
                    <span style={{ fontWeight: 600 }}>{picked} of 5 included this month</span>
                    <span className={styles.uiBoxes}>
                      {[0, 1, 2, 3, 4].map((b) => (
                        <i key={b} className={b < picked ? styles.uiBoxOn : ''} />
                      ))}
                    </span>
                  </span>
                  <span className={styles.uiSendBtn}>
                    {picked ? `Send ${picked} card${picked > 1 ? 's' : ''}` : 'Send cards'}
                  </span>
                </div>
              </div>
            )}

            {active === 2 && (
              <div key="track" className={`${styles.uiPanel} ${styles.uiFlip}`}>
                <p className={styles.uiH}>Tracking</p>
                {PICKED.map((i, r) => {
                  const level = Math.max(0, Math.min(STATUS.length, tick - (r > 0 && tick < STATUS.length ? 1 : 0)))
                  return (
                    <div key={HOMES[i].street} className={styles.uiTrack}>
                      <b>{HOMES[i].street}</b>
                      <div className={styles.uiSteps}>
                        <span className={styles.uiStepsLine}>
                          <i style={{ width: `${(Math.max(0, level - 1) / 3) * 100}%` }} />
                        </span>
                        {STATUS.map((st, k) => (
                          <span
                            key={st}
                            className={`${styles.uiStep} ${k < Math.max(1, level) ? styles.uiStepDone : ''} ${k === 3 ? styles.uiStepLast : ''}`}
                          >
                            <i />
                            {st}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
