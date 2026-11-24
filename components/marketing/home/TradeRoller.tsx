'use client'

import { useEffect, useRef } from 'react'
import styles from './home.module.css'

// Freddie's order: tradespeople, three trades, back to tradespeople, three more.
const WORDS = ['tradespeople', 'builders', 'plumbers', 'electricians', 'tradespeople', 'kitchen fitters', 'architects', 'interior designers']
const N = WORDS.length
const STEP = 360 / N
// One spin is half a turn: past three trades and on to the next "tradespeople".
const SPAN = 4
// Freddie (23 Nov): hold "tradespeople" for 2s, then spin through the three
// trades over 2s, slow, then fast, then slow again. Benjy (24 Nov): the whole
// thing 1.2x faster than that, so 2000 / 1.2 for both.
const HOLD = 1667
const SPIN = 1667
// A strong ease-in-out; a gentler curve read as a linear spin (Benjy, 24 Nov).
const EASE = 'cubic-bezier(.7, 0, .3, 1)'

const drumAt = (k: number) => `translateZ(calc(var(--r) * -1)) rotateX(${-k * STEP}deg)`

/**
 * "Tactical marketing for time-pressed [tradespeople]". Each word is printed on
 * one face of an eight-sided drum, like the cylinder of a revolver, seen
 * through a slot one line high. Every few seconds the drum spins half a turn,
 * flicking past three trades and settling on "tradespeople" again.
 */
export function TradeRoller() {
  const drumRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const drum = drumRef.current
    const slot = drum?.parentElement
    if (!drum || !slot) return
    const faces = Array.from(drum.children) as HTMLElement[]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let wi = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let anims: Animation[] = []
    let rolling = false

    const show = (i: number) => faces.forEach((f, j) => { f.style.opacity = j === i ? '1' : '0' })
    const clear = () => {
      anims.forEach((a) => { try { a.cancel() } catch {} })
      anims = []
    }
    const rest = () => {
      clearTimeout(timer)
      timer = undefined
      clear()
      rolling = false
      drum.style.transform = drumAt(wi)
      show(wi)
    }
    const schedule = () => {
      clearTimeout(timer)
      if (document.hidden) return
      timer = setTimeout(turn, HOLD)
    }
    const turn = () => {
      if (rolling) return
      rolling = true
      let next: number
      let done: Promise<Animation>
      if (reduce) {
        // no spinning: each word fades in where the last one was, one at a time
        next = (wi + 1) % N
        drum.style.transform = drumAt(next)
        faces[wi].style.opacity = '0'
        faces[next].style.opacity = '1'
        const fade = faces[next].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320 })
        anims = [fade]
        done = fade.finished
      } else {
        next = (wi + SPAN) % N
        const passing = Array.from({ length: SPAN + 1 }, (_, k) => faces[(wi + k) % N])
        passing.forEach((f) => { f.style.opacity = '1' })
        // look at the drum from the middle of the words going past, so none of them leans like italics
        const mid = passing.reduce((sum, f) => sum + (f.firstElementChild as HTMLElement).offsetWidth, 0) / passing.length / 2
        slot.style.perspectiveOrigin = `${mid.toFixed(1)}px 0.52em`
        const opts: KeyframeAnimationOptions = { duration: SPIN, easing: EASE, fill: 'both' }
        // wi + SPAN (not next), so the second half of the turn carries on round instead of spinning back
        const spin = drum.animate([{ transform: drumAt(wi) }, { transform: drumAt(wi + SPAN) }], opts)
        // the last trade dims as it turns away under the slot, so no sliver of it is left when the drum stops
        const last = passing[SPAN - 1].animate([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], opts)
        anims = [spin, last]
        done = spin.finished
      }
      done
        .then(() => {
          if (!rolling) return
          wi = next
          rest()
          schedule()
        })
        .catch(() => {})
    }
    const onVisibility = () => {
      if (document.hidden) rest()
      else schedule()
    }

    document.addEventListener('visibilitychange', onVisibility)
    rest()
    schedule()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(timer)
      clear()
      wi = 0
      drum.style.transform = drumAt(0)
      show(0)
    }
  }, [])

  return (
    <h1 className={styles.strap} id="strap">
      <span className={styles.line}>Tactical marketing</span>
      <span className={styles.line}>for time-pressed</span>
      <span className={styles.srOnly}>tradespeople</span>
      <span className={styles.roll} aria-hidden="true">
        <span className={styles.rollWin}>
          <span className={styles.drum} ref={drumRef}>
            {WORDS.map((w, i) => (
              <span
                key={i}
                className={styles.face}
                style={{ transform: `rotateX(${i * STEP}deg) translateZ(var(--r))`, opacity: i === 0 ? 1 : 0 }}
              >
                <span>{w}</span>
              </span>
            ))}
          </span>
        </span>
      </span>
    </h1>
  )
}
