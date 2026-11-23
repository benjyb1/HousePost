'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './home.module.css'

export type MapLead = { id: string; lat: number; lng: number; label: string; title: string }

type Props = {
  leads: MapLead[]
  selected: string[]
  locked: string[]
  hot: string | null
  office: { lat: number; lng: number } | null
  radius: number
  onToggle: (id: string) => void
  onHot: (id: string | null) => void
}

// OpenFreeMap: free vector tiles, no key. MapLibre is pinned to 5.24.0 because
// 6.x loads its worker from a separate file that Next doesn't copy (blank map).
const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const NAVY = '#0f1f3d'

function circle(lat: number, lng: number, miles: number, steps = 72): [number, number][] {
  const pts: [number, number][] = []
  const dLat = miles / 69.0
  const dLng = miles / (69.0 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return pts
}

function circleBounds(lat: number, lng: number, miles: number): maplibregl.LngLatBoundsLike {
  const dLat = miles / 69.0
  const dLng = miles / (69.0 * Math.cos((lat * Math.PI) / 180))
  return [[lng - dLng, lat - dLat], [lng + dLng, lat + dLat]]
}

/** The real street map beside the list: a price tag per home, your office, your patch. */
export default function LeadsMap({ leads, selected, locked, hot, office, radius, onToggle, onHot }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLButtonElement }>())
  const cb = useRef({ onToggle, onHot })
  const countRef = useRef(leads.length)
  useEffect(() => {
    cb.current = { onToggle, onHot }
    countRef.current = leads.length
  })

  // the map itself, once
  useEffect(() => {
    if (!boxRef.current) return
    const center: [number, number] = office ? [office.lng, office.lat] : leads[0] ? [leads[0].lng, leads[0].lat] : [-1.5, 52.5]
    const map = new maplibregl.Map({
      container: boxRef.current,
      style: STYLE,
      center,
      zoom: office ? 11 : 6,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    const box = boxRef.current
    const setFar = () => box.classList.toggle(styles.far, map.getZoom() < 13 && countRef.current > 25)
    map.on('zoom', setFar)
    map.on('load', setFar)

    if (office) {
      const pin = document.createElement('div')
      pin.setAttribute('aria-hidden', 'true')
      pin.innerHTML =
        `<svg class="${styles.pin}" viewBox="-19 -44 38 46"><ellipse cx="0" cy="0" rx="11" ry="3.5" fill="#1b2333" opacity=".18"/>` +
        `<path d="M0 0 C-4 -9 -18 -20 -18 -34 A18 18 0 0 1 18 -34 C18 -20 4 -9 0 0 Z" fill="${NAVY}"/>` +
        `<text x="0" y="-29.5" text-anchor="middle" fill="#fff" font-size="12" font-weight="700" font-family="var(--font-sans)">You</text></svg>`
      new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([office.lng, office.lat]).addTo(map)
    }

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(box)
    const live = markers.current
    return () => {
      ro.disconnect()
      live.clear()
      map.remove()
      mapRef.current = null
    }
    // The map is created once; leads, radius and selection update it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // your patch: a dashed circle at the saved distance, framed to fit
  useEffect(() => {
    const map = mapRef.current
    if (!map || !office) return
    const data: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(office.lat, office.lng, radius)] } }
    const apply = () => {
      const src = map.getSource('patch') as maplibregl.GeoJSONSource | undefined
      if (src) src.setData(data)
      else {
        map.addSource('patch', { type: 'geojson', data })
        map.addLayer({ id: 'patch-fill', type: 'fill', source: 'patch', paint: { 'fill-color': NAVY, 'fill-opacity': 0.04 } })
        map.addLayer({ id: 'patch-line', type: 'line', source: 'patch', paint: { 'line-color': NAVY, 'line-opacity': 0.4, 'line-width': 1.5, 'line-dasharray': [3, 3] } })
      }
      map.fitBounds(circleBounds(office.lat, office.lng, radius), { padding: 28, duration: 0 })
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [office, radius])

  // one marker per home: a price tag, or a dot when zoomed out over a busy patch
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const current = markers.current
    const keep = new Set(leads.map((l) => l.id))
    for (const [id, { m }] of current) {
      if (!keep.has(id)) { m.remove(); current.delete(id) }
    }
    for (const l of leads) {
      if (current.has(l.id)) continue
      const el = document.createElement('button')
      el.type = 'button'
      el.className = styles.marker
      el.setAttribute('aria-label', l.title)
      el.innerHTML = `<span class="${styles.tag}">${l.label}</span><span class="${styles.dotM}"></span>`
      el.addEventListener('click', (e) => { e.stopPropagation(); cb.current.onToggle(l.id) })
      el.addEventListener('mouseenter', () => cb.current.onHot(l.id))
      el.addEventListener('mouseleave', () => cb.current.onHot(null))
      el.addEventListener('focus', () => cb.current.onHot(l.id))
      el.addEventListener('blur', () => cb.current.onHot(null))
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -4] }).setLngLat([l.lng, l.lat]).addTo(map)
      current.set(l.id, { m, el })
    }
    boxRef.current?.classList.toggle(styles.far, map.getZoom() < 13 && leads.length > 25)
  }, [leads])

  // selection, locks and hover
  useEffect(() => {
    const on = new Set(selected)
    const lockedSet = new Set(locked)
    for (const [id, { el }] of markers.current) {
      el.classList.toggle(styles.mOn, on.has(id))
      el.classList.toggle(styles.mHot, hot === id)
      el.disabled = lockedSet.has(id)
      el.setAttribute('aria-pressed', String(on.has(id)))
    }
  }, [selected, locked, hot, leads])

  return <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} aria-label="Map of these homes" role="region" />
}
