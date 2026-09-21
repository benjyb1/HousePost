'use client'

import { useEffect, useRef } from 'react'

/**
 * The big hero headline: "For <trade>" where the trade word cycles through the
 * list every 3.2s. Each trade sits on the front face of a shallow cube that
 * tips upward, so the next trade rises from the bottom and the current one
 * lifts off the top. The perspective is kept large (flat) so the turn reads
 * almost parallel to the screen rather than steeply angled.
 *
 * SEO / accessibility notes:
 *  - Every trade is rendered in the server HTML (the sr-only sentence and the
 *    four cube faces), so crawlers always see the trades in the <h1>.
 *  - Screen readers get a single clean sentence; the animated cube is
 *    aria-hidden so AT never reads four overlaid words.
 *  - A hidden sizer reserves the width AND the (wrapped) height of the longest
 *    trade ("interior designers"), so cycling words never shift the layout.
 *  - prefers-reduced-motion: the cube never turns and the first trade shows.
 */

const TRADES = [
  'builders',
  'decorators',
  'plumbers',
  'architects',
  'electricians',
  'landscapers',
  'interior designers',
  'carpenters',
] as const

// The longest label — drives the reserved space so nothing jumps as words flip.
const WIDEST = 'interior designers'

const FLIP_MS = 3200 // time each trade is held
const TURN_MS = 620 // length of the flip itself
const DIR = 1 // tip upward: the next trade rises from the bottom

// Matches the existing hero accent: a soft blue gradient clipped to the text.
const BLUE_GRADIENT: React.CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, #cfe3fe, #93c5fd, #5b9bf5)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))',
}

const mod = (a: number, m: number) => ((a % m) + m) % m

// Which of the four faces sits at the front on the nth turn (base rotation -A).
const frontFace = (n: number) => mod(-DIR * 90 * n, 360) / 90

export function HeroTradeHeadline() {
  const sizerRef = useRef<HTMLSpanElement>(null)
  const cubeRef = useRef<HTMLSpanElement>(null)
  const f0 = useRef<HTMLSpanElement>(null)
  const f1 = useRef<HTMLSpanElement>(null)
  const f2 = useRef<HTMLSpanElement>(null)
  const f3 = useRef<HTMLSpanElement>(null)
  const faceRefs = [f0, f1, f2, f3]

  useEffect(() => {
    const cube = cubeRef.current
    const sizer = sizerRef.current
    const faces = [f0.current, f1.current, f2.current, f3.current]
    if (!cube || !sizer || faces.some((f) => f === null)) return
    const faceEls = faces as HTMLSpanElement[]

    // Keep the cube's depth equal to half the reserved height, so the four
    // faces form a square profile (no overlap through the fold) at any width —
    // one line on desktop, two lines when "interior designers" wraps on mobile.
    const measure = () => {
      cube.style.setProperty('--tz', `${sizer.offsetHeight / 2}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(() => {})
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let id: ReturnType<typeof setInterval> | undefined
    if (!mq.matches) {
      let n = 0
      id = setInterval(() => {
        n += 1
        cube.style.transform = `rotateX(${DIR * 90 * n}deg)`
        // Update only the face that has just rotated out of sight (net 180),
        // giving it the trade it will show next time it reaches the front.
        const back = mod(180 - DIR * 90 * n, 360) / 90
        faceEls[back].textContent = TRADES[(n + 2) % TRADES.length]
      }, FLIP_MS)
    }

    return () => {
      window.removeEventListener('resize', measure)
      if (id) clearInterval(id)
    }
  }, [])

  // Server-rendered face words: whichever face is at the front on turns 0..3
  // gets that turn's trade, so the cycle reads in list order from first paint.
  const seed = ['', '', '', '']
  for (let m = 0; m < 4; m++) seed[frontFace(m)] = TRADES[m % TRADES.length]

  const faceStyle = (k: number): React.CSSProperties => ({
    ...BLUE_GRADIENT,
    backfaceVisibility: 'hidden',
    transform: `rotateX(${k * 90}deg) translateZ(var(--tz, 0px))`,
  })

  return (
    <h1 className="text-white">
      {/* One clean, crawlable sentence for screen readers and search engines. */}
      <span className="sr-only">
        Local leads for {TRADES.slice(0, -1).join(', ')} and{' '}
        {TRADES[TRADES.length - 1]}.
      </span>

      {/* Visual, animated headline — hidden from assistive tech. */}
      <span
        aria-hidden="true"
        className="block font-extrabold leading-[1.05] tracking-tight text-5xl sm:text-6xl lg:text-7xl"
      >
        <span className="block">For</span>
        <span className="relative mt-1 block" style={{ perspective: '7000px' }}>
          {/* Invisible sizer reserves space for the longest trade (and its
              two-line height on narrow screens) so the line never jumps. */}
          <span ref={sizerRef} className="invisible block" aria-hidden="true">
            {WIDEST}
          </span>
          <span
            ref={cubeRef}
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'rotateX(0deg)',
              transition: `transform ${TURN_MS}ms cubic-bezier(0.5, 0.05, 0.25, 1)`,
            }}
          >
            {[0, 1, 2, 3].map((k) => (
              <span
                key={k}
                ref={faceRefs[k]}
                className="absolute inset-0"
                style={faceStyle(k)}
              >
                {seed[k]}
              </span>
            ))}
          </span>
        </span>
      </span>
    </h1>
  )
}
