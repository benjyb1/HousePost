'use client'

import { useEffect, useRef } from 'react'
import styles from './home.module.css'

// Freddie's order: tradespeople, three trades, back to tradespeople, three more.
const WORDS = ['tradespeople', 'builders', 'plumbers', 'electricians', 'tradespeople', 'kitchen fitters', 'architects', 'interior designers']
const STEP = 360 / WORDS.length
// Tradespeople holds a little longer than the trades, not twice as long (Benjy, 23 Nov).
const HOLD_HOME = 2300
const HOLD = 1700
// One click of the drum: it gathers speed, is fastest halfway, then slows to a
// stop (Freddie, 23 Nov). A strong ease-in-out over 1.1s, so the build-up and the
// settle are easy to see; a gentler curve read as a linear spin (Benjy, 24 Nov).
const DUR = 1100
const EASE = 'cubic-bezier(.7, 0, .3, 1)'

const drumAt = (k: number) => `translateZ(calc(var(--r) * -1)) rotateX(${-k * STEP}deg)`

/**
 * "Tactical marketing for time-pressed [tradespeople]". Each trade word is
 * printed on one face of an eight-sided drum, like the cylinder of a revolver,
 * seen through a slot one line high. The drum turns one face at a time, so new
 * words come over the top and the old one curves away underneath.
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
      timer = setTimeout(turn, WORDS[wi] === 'tradespeople' ? HOLD_HOME : HOLD)
    }
    const turn = () => {
      if (rolling) return
      rolling = true
      const next = (wi + 1) % WORDS.length
      const a = faces[wi]
      const b = faces[next]
      let done: Promise<Animation>
      if (reduce) {
        // no turning: the next word fades in where the last one was
        drum.style.transform = drumAt(next)
        a.style.opacity = '0'
        b.style.opacity = '1'
        const fade = b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320 })
        anims = [fade]
        done = fade.finished
      } else {
        // look at the drum from the middle of the two words, so neither leans like italics as it turns
        const wa = (a.firstElementChild as HTMLElement).offsetWidth
        const wb = (b.firstElementChild as HTMLElement).offsetWidth
        slot.style.perspectiveOrigin = `${((wa + wb) / 4).toFixed(1)}px 0.52em`
        const opts: KeyframeAnimationOptions = { duration: DUR, easing: EASE, fill: 'both' }
        // wi + 1 (not next), so the last word turns on to the first instead of spinning back round
        const spin = drum.animate([{ transform: drumAt(wi) }, { transform: drumAt(wi + 1) }], opts)
        // the word leaving dims as it turns away; the word arriving brightens as it faces you
        const out = a.animate([{ opacity: 1 }, { opacity: 0.8, offset: 0.5 }, { opacity: 0 }], opts)
        const inn = b.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.5 }, { opacity: 1 }], opts)
        anims = [spin, out, inn]
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
