'use client'

import { useEffect, useRef } from 'react'
import styles from './home.module.css'

// Freddie's order: tradespeople, three trades, back to tradespeople, three more.
const WORDS = ['tradespeople', 'builders', 'plumbers', 'electricians', 'tradespeople', 'kitchen fitters', 'architects', 'interior designers']
// Tradespeople holds a little longer than the trades, not twice as long (Benjy, 23 Nov).
const HOLD_HOME = 2300
const HOLD = 1700
const DUR = 620
const EASE = 'cubic-bezier(.66,0,.34,1)'

/**
 * "Tactical marketing for time-pressed [tradespeople]", with the last word
 * rolling down to the next trade. Whole words move inside a clipped line of
 * their own, so nothing overlaps the line above and nothing is cut into strips.
 */
export function TradeRoller() {
  const winRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const win = winRef.current
    if (!win) return
    const faces = [win.children[0] as HTMLElement, win.children[1] as HTMLElement]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cur = 0
    let wi = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let anims: Animation[] = []
    let rolling = false

    const frames = (dir: 'out' | 'in'): Keyframe[] => {
      if (reduce) return dir === 'out' ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }]
      return dir === 'out'
        ? [{ transform: 'translateY(0)', opacity: 1, offset: 0 }, { transform: 'translateY(62%)', opacity: 1, offset: 0.55 }, { transform: 'translateY(118%)', opacity: 0, offset: 1 }]
        : [{ transform: 'translateY(-118%)', opacity: 0, offset: 0 }, { transform: 'translateY(-62%)', opacity: 1, offset: 0.45 }, { transform: 'translateY(0)', opacity: 1, offset: 1 }]
    }
    const clear = () => {
      anims.forEach((a) => { try { a.cancel() } catch {} })
      anims = []
    }
    const rest = () => {
      clearTimeout(timer)
      timer = undefined
      clear()
      rolling = false
      faces[cur].textContent = WORDS[wi]
      faces[cur].classList.add(styles.isCur)
      faces[1 - cur].classList.remove(styles.isCur)
      faces[1 - cur].textContent = ''
    }
    const schedule = () => {
      clearTimeout(timer)
      if (document.hidden) return
      timer = setTimeout(turn, WORDS[wi] === 'tradespeople' ? HOLD_HOME : HOLD)
    }
    const turn = () => {
      if (rolling) return
      rolling = true
      const a = faces[cur]
      const b = faces[1 - cur]
      const next = (wi + 1) % WORDS.length
      b.textContent = WORDS[next]
      const opts: KeyframeAnimationOptions = { duration: reduce ? 320 : DUR, easing: reduce ? 'linear' : EASE, fill: 'both' }
      const out = a.animate(frames('out'), opts)
      const inn = b.animate(frames('in'), opts)
      anims = [out, inn]
      inn.finished
        .then(() => {
          if (!rolling) return
          rolling = false
          // swap roles before the cancelled animations could let the old state paint
          b.classList.add(styles.isCur)
          a.classList.remove(styles.isCur)
          clear()
          a.textContent = ''
          cur = 1 - cur
          wi = next
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
      faces[0].textContent = WORDS[0]
      faces[0].classList.add(styles.isCur)
      faces[1].textContent = ''
      faces[1].classList.remove(styles.isCur)
    }
  }, [])

  return (
    <h1 className={styles.strap} id="strap">
      <span className={styles.line}>Tactical marketing</span>
      <span className={styles.line}>for time-pressed</span>
      <span className={styles.srOnly}>tradespeople</span>
      <span className={styles.roll} aria-hidden="true">
        <span className={styles.rollWin} ref={winRef}>
          <span className={`${styles.rollWord} ${styles.isCur}`}>tradespeople</span>
          <span className={styles.rollWord} />
        </span>
      </span>
    </h1>
  )
}
