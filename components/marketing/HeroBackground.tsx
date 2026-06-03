'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

/**
 * Aerial-houses hero background with a very subtle parallax "float" as you
 * scroll. The image is scaled up slightly so the small downward drift never
 * exposes an edge, and the movement is deliberately gentle — just enough to
 * give the hero a bit of depth without drawing attention to itself.
 */
export function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Respect users who'd rather not have motion.
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    let frame = 0
    const update = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      // Cap the drift so the scaled-up image always stays covering.
      const y = Math.min(window.scrollY * 0.12, 36)
      el.style.transform = `translate3d(0, ${y}px, 0)`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 scale-110 will-change-transform"
    >
      <Image
        src="/hero-aerial.jpg"
        alt=""
        fill
        priority
        className="object-cover"
        style={{ filter: 'grayscale(100%) contrast(1.05) brightness(0.9)' }}
      />
    </div>
  )
}
