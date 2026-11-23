'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from '../portal.module.css'

/*
  The map view of this month's homes. OpenFreeMap's light "positron" style
  (free, no key, fine for commercial use) under MapLibre. Your office is the
  navy pin; each home is a price tag you tap to pick or unpick, orange when
  picked. On touch screens it takes two fingers to move, so a one-finger
  scroll still scrolls the page.
*/

export type MapHome = { id: string; lat: number; lng: number; label: string; address: string; picked: boolean }

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

type Lib = typeof import('maplibre-gl')
type MapInstance = InstanceType<Lib['Map']>
type MarkerInstance = InstanceType<Lib['Marker']>

export function HomesMap({
  office,
  homes,
  onToggle,
}: {
  office: { lat: number; lng: number } | null
  homes: MapHome[]
  onToggle: (id: string, picked: boolean) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const libRef = useRef<Lib | null>(null)
  const markers = useRef<Map<string, { marker: MarkerInstance; el: HTMLButtonElement }>>(new Map())
  const latest = useRef({ homes, onToggle })

  useEffect(() => {
    latest.current = { homes, onToggle }
  })

  // draw or update the home markers from the latest props
  const sync = () => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib) return
    const seen = new Set<string>()
    for (const h of latest.current.homes) {
      seen.add(h.id)
      let entry = markers.current.get(h.id)
      if (!entry) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = styles.marker
        const tag = document.createElement('span')
        tag.className = styles.markerTag
        el.appendChild(tag)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          const home = latest.current.homes.find((x) => x.id === h.id)
          if (home) latest.current.onToggle(home.id, !home.picked)
        })
        const marker = new lib.Marker({ element: el, anchor: 'bottom' }).setLngLat([h.lng, h.lat]).addTo(map)
        entry = { marker, el }
        markers.current.set(h.id, entry)
      }
      const tag = entry.el.firstChild as HTMLSpanElement
      tag.textContent = h.label || 'Home'
      entry.el.classList.toggle(styles.markerOn, h.picked)
      entry.el.setAttribute('aria-pressed', String(h.picked))
      entry.el.setAttribute('aria-label', `${h.address}${h.label ? `, ${h.label}` : ''}. ${h.picked ? 'Picked. Tap to remove.' : 'Tap to pick.'}`)
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) {
        entry.marker.remove()
        markers.current.delete(id)
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    const markerStore = markers.current
    import('maplibre-gl').then((mod) => {
      // MapLibre 5 ships one file with its tile worker built in, so it works
      // with the Next bundler as is (v6 loads the worker from a separate file).
      const lib = ((mod as unknown as { default?: Lib }).default ?? mod) as Lib
      if (cancelled || !boxRef.current) return
      libRef.current = lib
      const touch = window.matchMedia('(pointer: coarse)').matches
      const first = latest.current.homes[0]
      const map = new lib.Map({
        container: boxRef.current,
        style: STYLE_URL,
        center: office ? [office.lng, office.lat] : first ? [first.lng, first.lat] : [-1.5, 52.5],
        zoom: 13,
        attributionControl: { compact: true },
        cooperativeGestures: touch,
      })
      map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map

      if (office) {
        const pin = document.createElement('div')
        pin.innerHTML =
          '<svg width="34" height="42" viewBox="-17 -40 34 42" aria-hidden="true"><path d="M0 0C-4-9-15-18-15-30A15 15 0 0 1 15-30C15-18 4-9 0 0Z" fill="#0f1f3d"/><text y="-25.5" text-anchor="middle" fill="#fff" font-size="10.5" font-weight="700" font-family="system-ui,sans-serif">You</text></svg>'
        pin.setAttribute('aria-label', 'Your office')
        new lib.Marker({ element: pin, anchor: 'bottom' }).setLngLat([office.lng, office.lat]).addTo(map)
      }

      sync()
      const pts = latest.current.homes.map((h) => [h.lng, h.lat] as [number, number])
      if (office) pts.push([office.lng, office.lat])
      if (pts.length > 1) {
        const lngs = pts.map((p) => p[0])
        const lats = pts.map((p) => p[1])
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 60, maxZoom: 15, duration: 0 }
        )
      }
    })
    return () => {
      cancelled = true
      markerStore.clear()
      mapRef.current?.remove()
      mapRef.current = null
    }
    // the map is built once; markers follow the props below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    sync()
  })

  return <div ref={boxRef} className={styles.mapWrap} role="region" aria-label="Map of the homes. Tap a home to pick it." />
}
