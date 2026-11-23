'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import styles from './home.module.css'

/*
  Section 2: the premise, as Freddie described it. Each month a few homes that
  have just sold appear on the map, grey with a dark outline and their price.
  A card goes to two or three of them, which turn orange (targeted); the rest
  lose the outline and settle to grey. Then the next month does the same in new
  places. The month names on the right follow the map and can be clicked.
*/

type House = { x: number; y: number; targeted: boolean; price: string }

const MONTHS: { name: string; houses: House[] }[] = [
  {
    name: 'September',
    houses: [
      { x: 125, y: 150, targeted: true, price: '£685k' },
      { x: 235, y: 120, targeted: false, price: '£540k' },
      { x: 455, y: 140, targeted: true, price: '£1.2m' },
      { x: 565, y: 250, targeted: false, price: '£720k' },
      { x: 235, y: 370, targeted: true, price: '£905k' },
    ],
  },
  {
    name: 'October',
    houses: [
      { x: 125, y: 260, targeted: false, price: '£475k' },
      { x: 345, y: 480, targeted: true, price: '£1.05m' },
      { x: 565, y: 370, targeted: true, price: '£830k' },
      { x: 345, y: 150, targeted: false, price: '£610k' },
    ],
  },
  {
    name: 'November',
    houses: [
      { x: 40, y: 150, targeted: false, price: '£560k' },
      { x: 230, y: 470, targeted: true, price: '£1.4m' },
      { x: 455, y: 250, targeted: true, price: '£765k' },
      { x: 565, y: 480, targeted: false, price: '£640k' },
      { x: 125, y: 470, targeted: true, price: '£890k' },
    ],
  },
]

const MONTH_MS = 4600
const HOLD_MS = 1800
const OUT_MS = 600
const LOOP_MS = MONTH_MS * 3 + HOLD_MS + OUT_MS + 250
const LAUNCH = 1500
const GAP = 340
const FLY = 800
const REST_T = MONTH_MS * 2 + 4000

const GREY: [number, number, number] = [214, 218, 224]
const FLAT: [number, number, number] = [185, 191, 202]
const ORANGE: [number, number, number] = [255, 118, 20]

// the logo's house at map size, anchored at the middle of its base, with the door notch
const HOUSE_PATH =
  'M0 -26L13 -13V-11.24H8.86V0H2.35V-6.06H-2.35V0H-8.86V-11.24H-13V-13Z'

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
const easeBack = (k: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)
}
const mix = (a: number[], b: number[], k: number) =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`

export function NewSalesSection() {
  const svgRef = useRef<SVGSVGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const seekRef = useRef<(month: number) => void>(() => {})
  const [month, setMonth] = useState(2)

  useEffect(() => {
    const svg = svgRef.current
    const box = boxRef.current
    if (!svg || !box) return
    const NS = 'http://www.w3.org/2000/svg'
    const mk = <K extends keyof SVGElementTagNameMap>(
      tag: K,
      attrs: Record<string, string | number>,
      parent: Element = svg
    ) => {
      const el = document.createElementNS(NS, tag)
      for (const k in attrs) el.setAttribute(k, String(attrs[k]))
      parent.appendChild(el)
      return el
    }
    svg.textContent = ''
    box.querySelectorAll('[data-tag]').forEach((t) => t.remove())

    // streets: a slightly turned grid of blocks, one main road each way, a park
    const grid = mk('g', { transform: 'rotate(-6 300 300)' })
    const lines = [-260, -150, -40, 70, 180, 290, 400, 510, 620, 730, 840]
    mk('rect', { x: -300, y: 281, width: 1300, height: 18, fill: '#f3e7c4' }, grid)
    mk('rect', { x: 391, y: -300, width: 18, height: 1300, fill: '#f3e7c4' }, grid)
    for (let i = 0; i < lines.length - 1; i++)
      for (let j = 0; j < lines.length - 1; j++) {
        const x = lines[i] + 9
        const y = lines[j] + 9
        const w = lines[i + 1] - lines[i] - 18
        const h = lines[j + 1] - lines[j] - 18
        const park = lines[i] === 400 && lines[j] === 400
        mk('rect', { x, y, width: w, height: h, fill: park ? '#dbe8d1' : '#eceef1' }, grid)
        if (park)
          for (let t = 0; t < 6; t++)
            mk('circle', { cx: x + 16 + ((t * 31) % (w - 32)), cy: y + 18 + ((t * 23) % (h - 36)), r: 6 + (t % 3), fill: '#c8ddb9' }, grid)
      }

    const A = (-6 * Math.PI) / 180
    const C = Math.cos(A)
    const S = Math.sin(A)
    const rot = (x: number, y: number) => [300 + (x - 300) * C - (y - 300) * S, 300 + (x - 300) * S + (y - 300) * C]

    const houseLayer = mk('g', {})
    const [px, py] = rot(345, 370)
    const pin = mk('g', { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})` })
    pin.innerHTML =
      '<path d="M0 0C-4-9-17-19-17-32A17 17 0 0 1 17-32C17-19 4-9 0 0Z" fill="#0f1f3d"/><text y="-27.5" text-anchor="middle" fill="#fff" font-size="12" font-weight="700" font-family="system-ui, sans-serif">You</text>'
    const cardLayer = mk('g', {})

    type Built = {
      m: number
      k: number
      j: number
      targeted: boolean
      x: number
      y: number
      g: SVGGElement
      path: SVGPathElement
      card: SVGGElement | null
      tag: HTMLSpanElement
    }
    const built: Built[] = []
    const targetsInMonth: number[] = []
    MONTHS.forEach((mo, m) => {
      let j = 0
      mo.houses.forEach((h, k) => {
        const [x, y] = rot(h.x, h.y)
        const g = mk('g', { opacity: 0 }, houseLayer) as SVGGElement
        const path = mk('path', { d: HOUSE_PATH, stroke: '#132251', 'stroke-width': 1.8, 'stroke-linejoin': 'miter' }, g) as SVGPathElement
        let card: SVGGElement | null = null
        if (h.targeted) {
          card = mk('g', { opacity: 0 }, cardLayer) as SVGGElement
          card.innerHTML =
            '<rect x="-12" y="-8" width="24" height="16" fill="#fff" stroke="#0f1f3d" stroke-width="1.3"/><rect x="5" y="-5.5" width="4.5" height="5.5" fill="#ff7614"/><path d="M-8.5-2.5h8M-8.5 1h6M-8.5 4.5h7" stroke="#b9bfcb" stroke-width="1.2"/>'
        }
        const tag = document.createElement('span')
        tag.dataset.tag = ''
        tag.className = styles.tag
        tag.textContent = h.price
        tag.style.left = `${Math.min(92, Math.max(8, (x / 600) * 100)).toFixed(2)}%`
        tag.style.top = `${(((y - 31) / 600) * 100).toFixed(2)}%`
        tag.style.opacity = '0'
        box.appendChild(tag)
        built.push({ m, k, j: h.targeted ? j++ : -1, targeted: h.targeted, x, y, g, path, card, tag })
      })
      targetsInMonth.push(j)
    })

    let shownMonth = -1
    const render = (t: number) => {
      const tl = ((t % LOOP_MS) + LOOP_MS) % LOOP_MS
      const out = clamp((tl - 3 * MONTH_MS - HOLD_MS) / OUT_MS)
      const current = Math.min(2, Math.floor(tl / MONTH_MS))
      if (current !== shownMonth) {
        shownMonth = current
        setMonth(current)
      }
      for (const h of built) {
        const local = tl - h.m * MONTH_MS
        const appear = local - h.k * 200
        if (appear < 0) {
          h.g.setAttribute('opacity', '0')
          h.card?.setAttribute('opacity', '0')
          h.tag.style.opacity = '0'
          continue
        }
        let s = easeBack(clamp(appear / 380))
        let fill: string
        let outline = 1
        let tagOn = true
        if (h.targeted) {
          const launch = LAUNCH + h.j * GAP
          const c = clamp((local - launch - FLY) / 260)
          fill = mix(GREY, ORANGE, c)
          if (c > 0 && c < 1) s *= 1 + 0.2 * Math.sin(c * Math.PI)
          const p = (local - launch) / FLY
          if (h.card) {
            if (p > 0 && p < 1) {
              const e = ease(p)
              const sx = px
              const sy = py - 42
              const ex = h.x
              const ey = h.y - 12
              const cx = (sx + ex) / 2
              const cy = Math.min(sy, ey) - 80
              const bx = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * ex
              const by = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * ey
              const sc = p < 0.15 ? 0.7 + p * 2 : p > 0.8 ? 1 - (p - 0.8) * 2.4 : 1
              const op = p < 0.08 ? p / 0.08 : p > 0.88 ? (1 - p) / 0.12 : 1
              h.card.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${(-12 + 24 * e).toFixed(1)}) scale(${sc.toFixed(3)})`)
              h.card.setAttribute('opacity', (op * (1 - out)).toFixed(3))
            } else h.card.setAttribute('opacity', '0')
          }
        } else {
          const fadeAt = LAUNCH + (targetsInMonth[h.m] - 1) * GAP + FLY + 320
          const f = clamp((local - fadeAt) / 650)
          fill = mix(GREY, FLAT, f)
          outline = 1 - f
          tagOn = f < 0.5
        }
        // a month's price tags give way when the next month's homes arrive
        if (h.m < current) tagOn = false
        h.g.setAttribute('transform', `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)}) scale(${s.toFixed(3)})`)
        h.path.setAttribute('fill', fill)
        h.path.setAttribute('stroke-opacity', outline.toFixed(3))
        h.g.setAttribute('opacity', (1 - out).toFixed(3))
        h.tag.style.opacity = tagOn ? String((1 - out) * clamp(appear / 300)) : '0'
        h.tag.classList.toggle(styles.tagOff, !h.targeted && outline < 0.5)
      }
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let start = 0
    let running = false
    const frame = (now: number) => {
      if (!start) start = now
      render(now - start)
      raf = requestAnimationFrame(frame)
    }
    seekRef.current = (m: number) => {
      if (reduced) {
        render(m * MONTH_MS + 4000)
        return
      }
      start = performance.now() - (m * MONTH_MS + 150)
      if (!running) render(m * MONTH_MS + 150)
    }

    if (reduced) {
      render(REST_T)
      return () => {
        box.querySelectorAll('[data-tag]').forEach((t) => t.remove())
      }
    }

    render(REST_T)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true
          start = 0
          raf = requestAnimationFrame(frame)
        } else if (!entry.isIntersecting && running) {
          running = false
          cancelAnimationFrame(raf)
        }
      },
      { threshold: 0.2 }
    )
    io.observe(box)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      box.querySelectorAll('[data-tag]').forEach((t) => t.remove())
    }
  }, [])

  return (
    <section className={styles.sales} aria-labelledby="sales-title">
      <div className={styles.salesPlate}>
        <div ref={boxRef} className={`${styles.mapBox} ${styles.reveal}`}>
          <svg
            ref={svgRef}
            viewBox="0 0 600 600"
            role="img"
            aria-label="A street map. Each month a few homes that have just sold appear with their prices. A card flies to two or three of them, which turn orange. The others turn grey."
          />
        </div>
      </div>
      <div className={styles.salesCopy}>
        <div className={styles.months} role="group" aria-label="Show a month on the map">
          {MONTHS.map((mo, m) => (
            <button key={mo.name} type="button" aria-pressed={month === m} onClick={() => seekRef.current(m)}>
              {mo.name}
            </button>
          ))}
        </div>
        <div className={`${styles.salesBody} ${styles.reveal}`}>
          <h2 id="sales-title" className={styles.head}>
            Fresh leads every month
          </h2>
          <p>
            Each month you see the homes that have just sold near you, and what they sold for.
            Tick the ones worth a card and we post it to the new owners.
          </p>
        </div>
        <div className={styles.cells}>
          <Link href="/signup" className={`${styles.button} ${styles.buttonInk}`}>
            Start for £15 a month
          </Link>
          <a href="#check" className={`${styles.button} ${styles.cellQuiet}`}>
            Check your area
          </a>
        </div>
      </div>
    </section>
  )
}
