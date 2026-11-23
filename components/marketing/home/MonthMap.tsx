'use client'

import { useEffect, useRef } from 'react'
import styles from './home.module.css'

/*
  Freddie's simplified street atlas (22 Nov 2026). Each "month" a handful of
  newly sold homes pop up in grey with a black outline and a price. A card flies
  from your office to two or three of them and they turn orange (targeted); the
  rest lose the outline and settle to flat grey (in the system, not targeted).
  Then the next month repeats in new spots. No legend, no SOLD boards.

  One shared 15s loop: every element animates on the same timeline, so nothing
  drifts out of step, and every keyframe at the loop's end matches its start.
*/

const NS = 'http://www.w3.org/2000/svg'
const L = 15000
const EO = 'cubic-bezier(0.23, 1, 0.32, 1)'
const ES = 'cubic-bezier(0.37, 0, 0.63, 1)'
const END0 = 13300
const END1 = 13900
const FLIGHT = 950
const GAP = 350
const HOUSE = 'M-17 1 L0 -16 L17 1 V17 H-17 Z'
const ORANGE = '#ff7614'
const ORANGE_DEEP = '#e0620a'
const NAVY = '#0f1f3d'

type Home = { x: number; y: number; p: string; t: 0 | 1 }
const MONTHS: { start: number; send: number; resolve: number; tagsOff: number; homes: Home[] }[] = [
  {
    start: 600, send: 2700, resolve: 4950, tagsOff: 5800,
    homes: [{ x: 232, y: 168, p: '£685k', t: 1 }, { x: 470, y: 118, p: '£1.2m', t: 0 }, { x: 528, y: 326, p: '£540k', t: 1 }, { x: 205, y: 356, p: '£795k', t: 1 }, { x: 318, y: 106, p: '£475k', t: 0 }],
  },
  {
    start: 6800, send: 8600, resolve: 10750, tagsOff: 12300,
    homes: [{ x: 430, y: 204, p: '£980k', t: 0 }, { x: 566, y: 222, p: '£725k', t: 1 }, { x: 262, y: 262, p: '£598k', t: 0 }, { x: 438, y: 398, p: '£1.58m', t: 1 }],
  },
]

const fx = (n: number) => n.toFixed(2)
const tf = (x: number, y: number, s = 1, r = 0) => `translate(${fx(x)}px, ${fx(y)}px) rotate(${fx(r)}deg) scale(${s.toFixed(3)})`

function svgEl(parent: Element, tag: string, attrs: Record<string, string | number> = {}, html?: string) {
  const n = document.createElementNS(NS, tag)
  for (const k in attrs) n.setAttribute(k, String(attrs[k]))
  if (html != null) n.innerHTML = html
  parent.appendChild(n)
  return n
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** A quiet street-map base: blocks, a park and one main road, slightly turned. */
export function drawStreetMap(svg: SVGSVGElement, w: number, h: number, seed: number) {
  const rand = seeded(seed)
  svgEl(svg, 'rect', { width: w, height: h, fill: '#fcfbf7' })
  const g = svgEl(svg, 'g', { transform: `rotate(-8 ${w / 2} ${h / 2})` })
  const xs: number[] = []
  const ys: number[] = []
  for (let x = -160; x < w + 200; x += 110) xs.push(x + Math.round(rand() * 10))
  for (let y = -150; y < h + 200; y += 98) ys.push(y + Math.round(rand() * 8))
  const px = Math.floor(xs.length * 0.66)
  const py = Math.floor(ys.length * 0.55)
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + 8
      const y0 = ys[j] + 8
      const bw = xs[i + 1] - xs[i] - 16
      const bh = ys[j + 1] - ys[j] - 16
      if ((i === px || i === px + 1) && j === py) {
        svgEl(g, 'rect', { x: x0, y: y0, width: bw, height: bh, rx: 6, fill: '#d9e8cb' })
        for (let k = 0; k < 8; k++) {
          svgEl(g, 'circle', { cx: fx(x0 + 10 + rand() * (bw - 20)), cy: fx(y0 + 10 + rand() * (bh - 20)), r: fx(3.5 + rand() * 2.5), fill: '#c6dcb3' })
        }
        continue
      }
      svgEl(g, 'rect', { x: x0, y: y0, width: bw, height: bh, rx: 5, fill: '#eeebe3' })
      const fw = 13
      const fh = 10
      const step = 19
      const n = Math.floor((bw - 6) / step)
      const off = (bw - (n * step - (step - fw))) / 2
      for (let q = 0; q < n; q++) {
        svgEl(g, 'rect', { x: fx(x0 + off + q * step), y: y0 + 5, width: fw, height: fh, rx: 1.5, fill: '#e3dfd5' })
        svgEl(g, 'rect', { x: fx(x0 + off + q * step), y: y0 + bh - 5 - fh, width: fw, height: fh, rx: 1.5, fill: '#e3dfd5' })
      }
    }
  }
  const road = `M -30 ${h * 0.86} C ${w * 0.15} ${h * 0.82}, ${w * 0.27} ${h * 0.69}, ${w * 0.39} ${h * 0.55} S ${w * 0.65} ${h * 0.27}, ${w + 40} ${h * 0.19}`
  svgEl(svg, 'path', { d: road, fill: 'none', stroke: '#dcc77f', 'stroke-width': 19, 'stroke-linecap': 'round' })
  svgEl(svg, 'path', { d: road, fill: 'none', stroke: '#f3e2a6', 'stroke-width': 14, 'stroke-linecap': 'round' })
}

export const OFFICE_PIN =
  '<ellipse cx="0" cy="0" rx="12" ry="4" fill="#1b2333" opacity=".18"/>' +
  `<path d="M0 0 C-4 -9 -18 -20 -18 -34 A18 18 0 0 1 18 -34 C18 -20 4 -9 0 0 Z" fill="${NAVY}"/>` +
  '<text x="0" y="-29.5" text-anchor="middle" fill="#fff" font-size="12.5" font-weight="700">You</text>'

// easeInOutCubic, sampled for the card's flight
function cubic(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0, hi = 1, t = x
    for (let i = 0; i < 30; i++) {
      const v = ((ax * t + bx) * t + cx) * t
      if (Math.abs(v - x) < 1e-5) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return ((ay * t + by) * t + cy) * t
  }
}
const flightEase = cubic(0.65, 0, 0.35, 1)

type Frame = [number, Keyframe, string?]

export function MonthMap() {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const m0Ref = useRef<HTMLSpanElement>(null)
  const m1Ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const box = boxRef.current
    if (!svg || !box || !m0Ref.current || !m1Ref.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const anims: Animation[] = []

    const loop = (node: Element, frames: Frame[]) => {
      const kf: Keyframe[] = frames.map(([t, props, easing]) => ({ ...props, offset: Math.min(1, Math.max(0, t / L)), easing: easing || 'linear' }))
      if ((kf[0].offset as number) > 0) kf.unshift({ ...kf[0], offset: 0, easing: 'linear' })
      const last = kf[kf.length - 1]
      if ((last.offset as number) < 1) kf.push({ ...last, offset: 1, easing: 'linear' })
      for (let i = 1; i < kf.length; i++) if ((kf[i].offset as number) < (kf[i - 1].offset as number)) kf[i].offset = kf[i - 1].offset
      if (node instanceof SVGElement) {
        node.style.transformBox = 'view-box'
        node.style.transformOrigin = '0px 0px'
      }
      const a = node.animate(kf, { duration: L, iterations: Infinity })
      anims.push(a)
    }

    drawStreetMap(svg, 720, 480, 7)
    const O = { x: 360, y: 270 }
    const homesL = svgEl(svg, 'g')
    const ringL = svgEl(svg, 'g')
    const pinL = svgEl(svg, 'g')
    const tagL = svgEl(svg, 'g')
    const cardL = svgEl(svg, 'g')
    const pin = svgEl(pinL, 'g', {}, OFFICE_PIN)
    const launches: number[] = []

    MONTHS.forEach((m) => {
      let k = 0
      m.homes.forEach((h, i) => {
        const a = m.start + i * 300
        const depart = h.t ? m.send + k++ * GAP : 0
        const land = depart + FLIGHT
        if (h.t) launches.push(depart)

        // the home: a flat grey base, a black outline while it's new, orange once targeted
        const g = svgEl(homesL, 'g')
        svgEl(g, 'path', { d: HOUSE, fill: '#cbc5b8', 'stroke-linejoin': 'round' })
        const outline = svgEl(g, 'path', { d: HOUSE, fill: 'none', stroke: '#1c2420', 'stroke-width': 2.6, 'stroke-linejoin': 'round' })
        const orange = svgEl(g, 'path', { d: HOUSE, fill: ORANGE, stroke: ORANGE_DEEP, 'stroke-width': 1.4, 'stroke-linejoin': 'round' })
        const hid = { opacity: 0, transform: tf(h.x, h.y + 8, 0.7) }
        const up = { opacity: 1, transform: tf(h.x, h.y, 1) }
        loop(g, [[0, hid], [a, hid, EO], [a + 260, { opacity: 1, transform: tf(h.x, h.y - 2, 1.08) }, ES], [a + 420, up], [END0, up, EO], [END1, { opacity: 0, transform: tf(h.x, h.y, 1) }]])
        const off = h.t ? land : m.resolve
        loop(outline, [[0, { opacity: 1 }], [off, { opacity: 1 }], [off + (h.t ? 220 : 500), { opacity: 0 }], [END1 + 20, { opacity: 0 }], [END1 + 40, { opacity: 1 }]])
        if (h.t) loop(orange, [[0, { opacity: 0 }], [land, { opacity: 0 }], [land + 220, { opacity: 1 }], [END1 + 20, { opacity: 1 }], [END1 + 40, { opacity: 0 }]])
        else orange.setAttribute('opacity', '0')

        // its price, shown while the month is open
        const tw = h.p.length * 8 + 20
        const tag = svgEl(tagL, 'g', {},
          `<rect x="${fx(-tw / 2)}" y="-52" width="${fx(tw)}" height="24" rx="4" fill="#fff" stroke="#cfc4b1"/>` +
          `<text x="0" y="-35.5" text-anchor="middle" font-size="13" font-weight="600" fill="#1c2420">${h.p}</text>`)
        const th = { opacity: 0, transform: tf(h.x, h.y + 6, 0.9) }
        const ts = { opacity: 1, transform: tf(h.x, h.y, 1) }
        loop(tag, [[0, th], [a + 120, th, EO], [a + 480, ts], [m.tagsOff, ts], [m.tagsOff + 400, { opacity: 0, transform: tf(h.x, h.y, 1) }], [m.tagsOff + 420, th]])

        if (h.t) {
          // a soft ring where the card lands
          const ring = svgEl(ringL, 'ellipse', { rx: 20, ry: 7, fill: 'none', stroke: ORANGE, 'stroke-width': 2 })
          const r0 = { opacity: 0, transform: tf(h.x, h.y + 17, 1) }
          loop(ring, [[0, r0], [land, r0], [land + 10, { opacity: 0.7, transform: tf(h.x, h.y + 17, 1) }, EO], [land + 800, { opacity: 0, transform: tf(h.x, h.y + 17, 2.4) }], [land + 810, r0]])
          // the postcard's flight from your office
          const card = svgEl(cardL, 'g', {},
            '<rect x="-14" y="-9.5" width="28" height="19" rx="1.5" fill="#1b2333" opacity=".14" transform="translate(1.5 2.5)"/>' +
            '<rect x="-14" y="-9.5" width="28" height="19" rx="1.5" fill="#fff" stroke="#1b2333" stroke-width=".9"/>' +
            `<rect x="-11.5" y="-7" width="10" height="14" fill="${NAVY}"/><rect x="6" y="-7" width="5" height="5.5" fill="${ORANGE}"/>` +
            '<line x1="1" y1="1.5" x2="11" y2="1.5" stroke="#c3c8d2" stroke-width="1.2"/><line x1="1" y1="5" x2="9" y2="5" stroke="#c3c8d2" stroke-width="1.2"/>')
          const P0 = { x: O.x, y: O.y - 40 }
          const P2 = { x: h.x, y: h.y - 4 }
          const C = { x: (P0.x + P2.x) / 2, y: Math.min(P0.y, P2.y) - (40 + Math.hypot(P2.x - P0.x, P2.y - P0.y) * 0.3) }
          const dir = P2.x >= P0.x ? 1 : -1
          const ch = { opacity: 0, transform: tf(P0.x, P0.y, 0.5) }
          const fr: Frame[] = [[0, ch], [depart - 1, ch]]
          for (let s = 0; s <= 24; s++) {
            const u = s / 24
            const e = flightEase(u)
            const q = 1 - e
            const cx = q * q * P0.x + 2 * q * e * C.x + e * e * P2.x
            const cy = q * q * P0.y + 2 * q * e * C.y + e * e * P2.y
            fr.push([depart + u * FLIGHT, { opacity: Math.min(1, u / 0.08), transform: tf(cx, cy, 0.8 + 0.3 * Math.sin(Math.PI * e), dir * (-12 + 20 * e)) }])
          }
          fr.push([land + 200, { opacity: 0, transform: tf(P2.x, P2.y + 4, 0.4, dir * 6) }], [land + 210, ch])
          loop(card, fr)
        }
      })
    })

    // your office gives a small press each time a card leaves
    const rest = { transform: tf(O.x, O.y, 1) }
    const pf: Frame[] = [[0, rest]]
    launches.forEach((t) => pf.push([t - 1, rest, EO], [t + 90, { transform: tf(O.x, O.y, 0.9) }, EO], [t + 320, rest]))
    loop(pin, pf)

    // month labels
    loop(m0Ref.current, [[0, { opacity: 0 }], [200, { opacity: 0 }], [500, { opacity: 1 }], [6300, { opacity: 1 }], [6550, { opacity: 0 }]])
    loop(m1Ref.current, [[0, { opacity: 0 }], [6550, { opacity: 0 }], [6800, { opacity: 1 }], [END0, { opacity: 1 }], [END1, { opacity: 0 }]])

    // reduced motion: a still frame with both months resolved
    if (reduce) anims.forEach((a) => { a.pause(); a.currentTime = 11600 })

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
      document.removeEventListener('visibilitychange', sync)
      anims.forEach((a) => a.cancel())
      svg.innerHTML = ''
    }
  }, [])

  return (
    <div
      className={styles.anim}
      ref={boxRef}
      role="img"
      aria-label="A street map. Each month a handful of newly sold homes appear in grey. A postcard flies from your office to some of them, and those turn orange. The rest stay grey."
    >
      <svg ref={svgRef} viewBox="0 0 720 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" />
      <div className={styles.months} aria-hidden="true">
        <span ref={m0Ref}>October</span>
        <span ref={m1Ref}>November</span>
      </div>
    </div>
  )
}
