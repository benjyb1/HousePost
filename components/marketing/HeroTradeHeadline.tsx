'use client'

import { useEffect, useState } from 'react'

/**
 * The big hero headline: "For <trade>" where the trade word cycles through the
 * list every 2.5s. Each word rolls over and flattens as if pressed under a
 * steamroller, and the next word un-squashes back up on the other side.
 *
 * SEO / accessibility notes:
 *  - Every trade is rendered in the server HTML (no words are injected by JS
 *    after load), so crawlers see the full list of trades in the <h1>.
 *  - The rotating words are shown/hidden purely with CSS opacity, never removed
 *    from the DOM, so the content stays crawlable at all times.
 *  - Screen readers get a single, clean sentence (the sr-only span); the
 *    animated stack is aria-hidden so AT never reads eight overlaid words.
 *  - A hidden sizer reserves the width AND height of the longest trade
 *    ("interior designers"), so cycling words never shift the layout.
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

const FLIP_MS = 2500

// Matches the existing hero accent: a soft blue gradient clipped to the text.
const BLUE_GRADIENT: React.CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, #cfe3fe, #93c5fd, #5b9bf5)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))',
}

export function HeroTradeHeadline() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    // Respect users who'd rather not have motion — leave the first trade shown.
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    const id = setInterval(() => {
      setTick((t) => t + 1)
    }, FLIP_MS)
    return () => clearInterval(id)
  }, [])

  const active = tick % TRADES.length
  const leaving = (active - 1 + TRADES.length) % TRADES.length

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
        <span className="relative mt-1 block" style={{ perspective: '400px' }}>
          {/* Invisible sizer reserves space for the longest trade (and its
              two-line height on narrow screens) so the line never jumps. */}
          <span className="invisible" aria-hidden="true">
            {WIDEST}
          </span>
          {TRADES.map((trade, i) => {
            // Only the word rolling in and the word rolling out get an
            // animation (and a tick-suffixed key so it restarts each cycle);
            // every other word sits fully hidden with no transform at all.
            const animateIn = i === active && tick > 0
            const animateOut = i === leaving && tick > 0
            return (
              <span
                key={animateIn || animateOut ? `${trade}-${tick}` : trade}
                className={
                  'absolute inset-0' +
                  (animateIn ? ' trade-roll-in' : animateOut ? ' trade-roll-out' : '')
                }
                style={{
                  ...BLUE_GRADIENT,
                  backfaceVisibility: 'hidden',
                  opacity: i === active || animateOut ? undefined : 0,
                }}
              >
                {trade}
              </span>
            )
          })}
        </span>
      </span>
    </h1>
  )
}
