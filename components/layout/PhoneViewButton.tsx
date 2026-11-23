'use client'

import { useEffect, useState } from 'react'

/*
  Preview-only helper: a "Phone view" button that shows the current page in a
  390 x 844 frame, so a design can be checked at phone width from a laptop.
  The root layout only renders this on Vercel preview builds and in local
  development, never in production. Inside the frame it hides itself.
*/

const W = 390
const H = 844

export function PhoneViewButton() {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState('')
  const [inFrame, setInFrame] = useState(true)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const framed = window.self !== window.top
    const fit = () => setScale(Math.min(1, (window.innerHeight - 96) / H))
    // read the window once on mount; this component only exists in previews
    queueMicrotask(() => {
      setInFrame(framed)
      fit()
    })
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (inFrame) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSrc(window.location.href)
          setOpen(true)
        }}
        style={{
          position: 'fixed',
          left: 'max(16px, env(safe-area-inset-left, 0px))',
          bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          zIndex: 2147483000,
          background: '#0f1f3d',
          color: '#ffffff',
          border: 0,
          borderRadius: 0,
          padding: '12px 16px',
          font: '600 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif',
          cursor: 'pointer',
        }}
      >
        Phone view
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Phone view of this page"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483001,
            background: 'rgba(15, 31, 61, 0.72)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'grid', gap: 12, justifyItems: 'end' }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: '#ffffff',
                color: '#0f1f3d',
                border: 0,
                borderRadius: 0,
                padding: '10px 14px',
                font: '600 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <div style={{ width: W * scale, height: H * scale, overflow: 'hidden', background: '#ffffff' }}>
              <iframe
                title="Phone view"
                src={src}
                style={{
                  width: W,
                  height: H,
                  border: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: '0 0',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
