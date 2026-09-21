'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { CARD_W, CARD_H } from '../svg-templates/helpers'
import { clampOverlay, overlayHeight, type LogoOverlay } from './types'

/**
 * Sits over the SVG preview and lets the user drag and resize their logo.
 * Positions are percentages of the card, so the box lines up with where the
 * <image> lands in the export regardless of preview size.
 */
export function LogoLayer({
  overlay,
  onChange,
  onRemove,
}: {
  overlay: LogoOverlay
  /** Called on every pointer move with `commit` false; once on pointer-up with `commit` true (the value is unchanged then — it just closes the undo step). */
  onChange: (next: LogoOverlay, commit: boolean) => void
  onRemove: () => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; start: LogoOverlay } | null>(null)

  /** Card px per screen px, from the layer's rendered width. */
  function scale() {
    const width = layerRef.current?.getBoundingClientRect().width ?? CARD_W
    return CARD_W / width
  }

  function begin(mode: 'move' | 'resize') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      gesture.current = { mode, startX: e.clientX, startY: e.clientY, start: overlay }
    }
  }

  function move(e: React.PointerEvent) {
    e.stopPropagation() // the resize handle is inside the box; don't let one move fire twice
    const g = gesture.current
    if (!g) return
    const k = scale()
    const dx = (e.clientX - g.startX) * k
    const dy = (e.clientY - g.startY) * k
    const next =
      g.mode === 'move'
        ? { ...g.start, x: g.start.x + dx, y: g.start.y + dy }
        : { ...g.start, w: g.start.w + Math.max(dx, dy * (g.start.naturalW / g.start.naturalH)) }
    onChange(clampOverlay(next), false)
  }

  function end(e: React.PointerEvent) {
    e.stopPropagation()
    if (!gesture.current) return
    gesture.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    onChange(overlay, true)
  }

  const h = overlayHeight(overlay)
  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      <div
        role="img"
        aria-label="Your logo. Drag to move, use the corner to resize"
        className="group pointer-events-auto absolute cursor-move touch-none select-none outline-1 outline-dashed outline-transparent hover:outline-blue-400 focus-visible:outline-blue-500"
        style={{ left: pct(overlay.x, CARD_W), top: pct(overlay.y, CARD_H), width: pct(overlay.w, CARD_W), height: pct(h, CARD_H) }}
        tabIndex={0}
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={overlay.src} alt="" draggable={false} className="h-full w-full object-contain" />
        <button
          type="button"
          aria-label="Remove logo"
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-2.5 -top-2.5 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow group-hover:flex group-focus-visible:flex"
        >
          <X className="h-3 w-3" />
        </button>
        <span
          aria-hidden
          onPointerDown={begin('resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-blue-500 shadow"
        />
      </div>
    </div>
  )
}
