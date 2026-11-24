'use client'

import { useEffect, useRef } from 'react'
import { HOUSE_OUTLINE, HOUSE_WINDOW } from '@/components/brand/Logo'
import s from './demo.module.css'

/*
  A looping demo of the signed-in site for "How it works": three homes get
  ticked, Send is pressed, then the three cards move through Scheduled,
  Printing, Dispatched and Delivered on Tracking. One 12s timeline. Labels and
  screens fade out before the next fades in, so two never overlap.
*/

const DL = 12000
const ROWS = [
  ['5 Mill Pond Row', 'Terraced · 0.3 mi', '£540,000'],
  ['27 Wey Terrace', 'Terraced · 0.4 mi', '£512,000'],
  ['14 Larkfield Road', 'Semi-detached · 0.6 mi', '£685,000'],
  ['41 Holloway Hill', 'Semi-detached · 0.9 mi', '£795,000'],
  ['3 Orchard Rise', 'Detached · 1.1 mi', '£1,240,000'],
]
const SENT = [
  ['5 Mill Pond Row', 'Godalming GU7 1HY'],
  ['14 Larkfield Road', 'Godalming GU7 1QL'],
  ['41 Holloway Hill', 'Godalming GU7 1QZ'],
]
const STEPS = ['Scheduled', 'Printing', 'Dispatched', 'Delivered']

type Frame = [number, Keyframe, string?]

export function DemoLoop() {
  const boxRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = boxRef.current
    const ds = stageRef.current
    if (!box || !ds) return
    const q = (sel: string) => ds.querySelector(sel) as HTMLElement
    const qa = (sel: string) => Array.from(ds.querySelectorAll(sel)) as HTMLElement[]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const anims: Animation[] = []

    const fit = () => {
      const w = box.clientWidth
      if (w) ds.style.transform = `scale(${(w / 480).toFixed(4)})`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)

    const loop = (node: Element, frames: Frame[]) => {
      const kf: Keyframe[] = frames.map(([t, props, easing]) => ({ ...props, offset: Math.min(1, Math.max(0, t / DL)), easing: easing || 'linear' }))
      if ((kf[0].offset as number) > 0) kf.unshift({ ...kf[0], offset: 0, easing: 'linear' })
      const last = kf[kf.length - 1]
      if ((last.offset as number) < 1) kf.push({ ...last, offset: 1, easing: 'linear' })
      for (let i = 1; i < kf.length; i++) if ((kf[i].offset as number) < (kf[i - 1].offset as number)) kf[i].offset = kf[i - 1].offset
      anims.push(node.animate(kf, { duration: DL, iterations: Infinity }))
    }
    const on = { opacity: 1 }
    const off = { opacity: 0 }
    const MOVE = 'cubic-bezier(.45,0,.25,1)'

    // the two screens, and the tab that shows which one you're on
    loop(q('[data-k="home"]'), [[0, on], [4700, on], [4850, off], [11650, off], [11800, on]])
    loop(q('[data-k="track"]'), [[0, off], [4850, off], [5000, on], [11500, on], [11650, off]])
    loop(q('[data-k="tab-home"]'), [[0, on], [4800, on], [4950, off], [11750, off], [11900, on]])
    loop(q('[data-k="tab-track"]'), [[0, off], [4800, off], [4950, on], [11750, on], [11900, off]])

    // three homes get ticked
    ;[[0, 1150], [2, 1950], [3, 2650]].forEach(([row, t]) => {
      const fr: Frame[] = [[0, off], [t - 80, off], [t, on], [5200, on], [5210, off]]
      loop(q(`[data-row="${row}"] [data-k="tint"]`), fr)
      loop(q(`[data-row="${row}"] [data-k="tick"]`), fr)
    })
    const txt = qa('[data-k="txt"] span')
    const T = [0, 1150, 1950, 2650, 5200]
    loop(txt[0], [[0, on], [1050, on], [1150, off], [5200, off], [5210, on]])
    for (let i = 1; i < 4; i++) loop(txt[i], [[0, off], [T[i], off], [T[i] + 100, on], [T[i + 1] - 100, on], [T[i + 1], off]])
    loop(q('[data-k="btn-on"]'), [[0, off], [1100, off], [1150, on], [5200, on], [5210, off]])
    loop(q('[data-k="btn-label"]'), [[0, off], [1100, off], [1150, on], [5200, on], [5210, off]])
    loop(q('[data-k="btn"]'), [[0, { transform: 'scale(1)' }], [3540, { transform: 'scale(1)' }], [3610, { transform: 'scale(.94)' }], [3760, { transform: 'scale(1)' }]])

    // the pointer that does it
    const at = (x: number, y: number, o: number, sc = 1): Keyframe => ({ opacity: o, transform: `translate(${x - 4}px, ${y - 2}px) scale(${sc})` })
    loop(q('[data-k="cursor"]'), [
      [0, at(400, 230, 0)], [300, at(400, 230, 1), MOVE], [950, at(31, 119, 1)], [1000, at(31, 119, 1, 0.85)], [1120, at(31, 119, 1), MOVE],
      [1700, at(31, 219, 1)], [1800, at(31, 219, 1, 0.85)], [1920, at(31, 219, 1), MOVE],
      [2400, at(31, 269, 1)], [2500, at(31, 269, 1, 0.85)], [2620, at(31, 269, 1), MOVE],
      [3400, at(410, 372, 1)], [3500, at(410, 372, 1, 0.85)], [3620, at(410, 372, 1)],
      [4400, at(410, 372, 1)], [4650, at(410, 372, 0)], [4700, at(400, 230, 0)],
    ])

    // then the three cards move through the stages in Tracking
    for (let r = 0; r < 3; r++) {
      const d = r * 160
      const dots = qa(`[data-trow="${r}"] [data-k="dot"]`)
      const lines = qa(`[data-trow="${r}"] [data-k="line"]`)
      const stats = qa(`[data-trow="${r}"] [data-k="stat"]`)
      const when = [5100, 6500 + d, 7900 + d, 9300 + d]
      for (let k = 0; k < 4; k++) {
        loop(dots[k], [[0, off], [when[k], off], [when[k] + 200, on], [11950, on], [11960, off]])
        const t1 = k < 3 ? when[k + 1] : 11800
        loop(stats[k], [[0, off], [when[k] + 120, off], [when[k] + 240, on], [t1, on], [t1 + 120, off]])
        if (k < 3) {
          const x0 = { transform: 'scaleX(0)' }
          const x1 = { transform: 'scaleX(1)' }
          loop(lines[k], [[0, x0], [when[k + 1] - 600, x0], [when[k + 1], x1], [11950, x1], [11960, x0]])
        }
      }
    }
    if (reduce) anims.forEach((a) => { a.pause(); a.currentTime = 10500 })

    let inView = false
    const sync = () => {
      const play = inView && !reduce && !document.hidden
      anims.forEach((a) => (play ? a.play() : a.pause()))
    }
    const io = new IntersectionObserver((en) => { inView = en[0].isIntersecting; sync() }, { threshold: 0.05 })
    io.observe(box)
    document.addEventListener('visibilitychange', sync)
    sync()

    return () => {
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', sync)
      anims.forEach((a) => a.cancel())
    }
  }, [])

  return (
    <div
      className={s.demo}
      ref={boxRef}
      role="img"
      aria-label="A short loop of the Housepost site: three homes are ticked, Send is pressed, and the three cards move through Scheduled, Printing, Dispatched and Delivered on the Tracking page."
    >
      <div className={s.ds} ref={stageRef} aria-hidden="true">
        <div className={s.bar}>
          <svg viewBox="0 0 3000 3000">
            <path fill="#132251" fillRule="evenodd" d={HOUSE_OUTLINE} />
            <path fill="#132251" fillRule="evenodd" d={HOUSE_WINDOW} />
          </svg>
          Housepost
          <div className={s.tabs}>
            <span><i data-k="tab-home" /><em>Home</em></span>
            <span><i data-k="tab-track" /><em>Tracking</em></span>
          </div>
        </div>
        <div className={s.scene} data-k="home">
          <div className={s.h}>Home</div>
          {ROWS.map(([street, meta, price], i) => (
            <div key={street} className={s.row} data-row={i} style={{ top: 50 + i * 50 }}>
              <i className={s.tint} data-k="tint" />
              <span className={s.cb}><i data-k="tick" /></span>
              <span className={s.addr}><b>{street}</b><span>{meta}</span></span>
              <span className={s.price}>{price}</span>
            </div>
          ))}
          <div className={s.send}>
            <div className={s.txt} data-k="txt">
              <span>No homes picked</span><span>1 home picked</span><span>2 homes picked</span><span>3 homes picked</span>
            </div>
            <div className={s.btn} data-k="btn">
              <i data-k="btn-on" />
              <em>Send</em>
              <em className={s.on} data-k="btn-label">Send</em>
            </div>
          </div>
        </div>
        <div className={s.scene} data-k="track" style={{ opacity: 0 }}>
          <div className={s.h}>Tracking</div>
          <div className={s.note}>3 cards scheduled. You can cancel for 15 minutes.</div>
          {SENT.map(([street, town], r) => (
            <div key={street} className={s.trow} data-trow={r} style={{ top: 96 + r * 84 }}>
              <b>{street}</b>
              <span>{town}</span>
              <div className={s.stat}>{STEPS.map((st) => <span key={st} data-k="stat">{st}</span>)}</div>
              <div className={s.track}>
                {[0, 1, 2].map((k) => (
                  <span key={k} className={s.line} style={{ left: `calc(${k * 33.33}% + 6px)`, width: 'calc(33.33% - 12px)' }}><i data-k="line" /></span>
                ))}
                {['6px', '33.33%', '66.67%', 'calc(100% - 6px)'].map((left) => (
                  <span key={left} className={s.dot} style={{ left }}><i data-k="dot" /></span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <svg className={s.cursor} data-k="cursor" viewBox="0 0 24 24">
          <path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.8 L11.6 14 L18 14 Z" fill="#fff" stroke="#1c2420" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
