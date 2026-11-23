'use client'

import { useEffect, useRef } from 'react'
import styles from './home.module.css'

/*
  "Tactical marketing for time-pressed <trade>". The trade sits on a paint
  roller: each change is half a turn, the old word rolling up and over the top
  while the next comes round from below. "tradespeople" is home base; between
  visits the roller runs through a set of three trades, then a different set.

  At rest the word is plain text (no seams). Only during a turn is it drawn as
  thin strips laid round the drum, which is what makes it bend like print on a
  roller rather than flip like a card.
*/

const HOME = 'tradespeople'
const SET_A = ['builders', 'plumbers', 'electricians']
const SET_B = ['kitchen fitters', 'architects', 'interior designers']
const SEQUENCE = [HOME, ...SET_A, HOME, ...SET_B]
const ALL = [HOME, ...SET_A, ...SET_B]

const STRIPS = 14
const TURN_MS = 900
const HOLD_HOME_MS = 3300
const HOLD_MS = 1700

export function RollerHeadline() {
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const flat = root.querySelector<HTMLSpanElement>('[data-flat]')!
    const win = root.querySelector<HTMLSpanElement>('[data-win]')!
    const drum = root.querySelector<HTMLSpanElement>('[data-drum]')!
    const measure = root.querySelector<HTMLSpanElement>('[data-measure]')!

    // two faces on opposite sides of the drum, each cut into strips
    drum.textContent = ''
    const faces = [0, 1].map(() => {
      const face = document.createElement('span')
      face.className = styles.rollerFace
      drum.appendChild(face)
      return Array.from({ length: STRIPS }, () => {
        const strip = document.createElement('span')
        strip.className = styles.rollerSlice
        strip.appendChild(document.createElement('span'))
        face.appendChild(strip)
        return strip
      })
    })
    const setFace = (f: number, word: string) =>
      faces[f].forEach((s) => ((s.firstChild as HTMLSpanElement).textContent = word))

    let radius = 0
    const widths: Record<string, number> = {}

    const layout = () => {
      root.style.fontSize = ''
      const avail = root.clientWidth
      let widest = 0
      for (const w of ALL) {
        measure.textContent = w
        widths[w] = measure.offsetWidth
        widest = Math.max(widest, widths[w])
      }
      const k = widest > avail && widest > 0 ? avail / widest : 1
      for (const w of ALL) widths[w] *= k
      root.style.fontSize = `${(k * 100).toFixed(2)}%`
      const fs = parseFloat(getComputedStyle(root).fontSize)
      const G = fs * 1.32 // strip box: the word plus room for ascenders and descenders
      radius = G / 1.9
      win.style.perspective = `${(G * 16).toFixed(1)}px`
      const band = G / STRIPS
      const hb = band + 1.5
      faces.forEach((strips, f) =>
        strips.forEach((s, j) => {
          const yk = (j + 0.5) * band - G / 2
          const a = f * Math.PI + yk / radius
          const inner = s.firstChild as HTMLSpanElement
          s.style.height = `${hb.toFixed(2)}px`
          s.style.top = `${(-hb / 2).toFixed(2)}px`
          inner.style.height = `${G}px`
          inner.style.lineHeight = `${G}px`
          inner.style.top = `${(-(j * band) + 0.75).toFixed(2)}px`
          s.style.transform = `rotateX(${(-a).toFixed(5)}rad) translateZ(${radius.toFixed(2)}px)`
        })
      )
      drum.style.transition = 'none'
      drum.style.transform = `translateZ(${(-radius).toFixed(2)}px) rotateX(${turns * 180}deg)`
    }

    let idx = 0
    let turns = 0
    let front = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    flat.textContent = SEQUENCE[0]
    setFace(0, SEQUENCE[0])
    layout()

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const step = () => {
      const next = (idx + 1) % SEQUENCE.length
      const back = 1 - front
      setFace(front, SEQUENCE[idx])
      setFace(back, SEQUENCE[next])
      // look at the middle of the two words, so the turn doesn't lean
      win.style.perspectiveOrigin = `${((widths[SEQUENCE[idx]] + widths[SEQUENCE[next]]) / 4).toFixed(0)}px 0.79em`
      root.classList.add(styles.rolling)
      turns += 1
      drum.style.transition = `transform ${TURN_MS}ms cubic-bezier(.62,0,.28,1)`
      drum.style.transform = `translateZ(${(-radius).toFixed(2)}px) rotateX(${turns * 180}deg)`
      front = back
      idx = next
      timer = setTimeout(() => {
        flat.textContent = SEQUENCE[idx]
        root.classList.remove(styles.rolling)
        timer = setTimeout(step, SEQUENCE[idx] === HOME ? HOLD_HOME_MS : HOLD_MS)
      }, TURN_MS + 30)
    }

    if (!reduced) timer = setTimeout(step, HOLD_HOME_MS)

    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(layout, 120)
    }
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(layout).catch(() => {})

    return () => {
      clearTimeout(timer)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <h1 className={styles.heroTitle}>
      <span className={styles.srOnly}>
        Tactical marketing for time-pressed tradespeople: builders, plumbers, electricians, kitchen
        fitters, architects and interior designers.
      </span>
      <span aria-hidden="true" style={{ display: 'block' }}>
        Tactical marketing for <span style={{ whiteSpace: 'nowrap' }}>time-pressed</span>
      </span>
      <span ref={rootRef} className={styles.roller} aria-hidden="true">
        <span data-measure className={styles.rollerMeasure} />
        <span data-flat className={styles.rollerFlat}>
          {HOME}
        </span>
        <span data-win className={styles.rollerWin}>
          <span data-drum className={styles.rollerDrum} />
        </span>
      </span>
    </h1>
  )
}
