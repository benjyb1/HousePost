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

/*
  The street map beside the list. Homes are drawn by the map engine on the GPU
  (a circle layer plus a label layer), not as page elements, so thousands of
  homes pan and zoom without lag. Prices show as tags once you zoom in, and
  hide themselves rather than overlap; picked homes win when space is tight.
  One small page element follows whichever home you hover, so its price is
  always visible.

  OpenFreeMap: free vector tiles, no key. MapLibre is pinned to 5.24.0 because
  6.x loads its worker from a separate file that Next doesn't copy (blank map).
*/
const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const NAVY = '#0f1f3d'
const INK = '#1c2420'
const ORANGE = '#ff7614'
const ORANGE_DEEP = '#e0620a'
const LINE_2 = '#cfc4b1'
const TAG_ZOOM = 13.5

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

/** A stretchable rounded tag for the price labels, drawn once at 2x. */
function tagImage(fill: string, stroke: string) {
  const r = 2
  const w = 32 * r
  const h = 24 * r
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const rad = 4 * r
  g.beginPath()
  g.moveTo(rad + 1, 1)
  g.arcTo(w - 1, 1, w - 1, h - 1, rad)
  g.arcTo(w - 1, h - 1, 1, h - 1, rad)
  g.arcTo(1, h - 1, 1, 1, rad)
  g.arcTo(1, 1, w - 1, 1, rad)
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = 2
  g.strokeStyle = stroke
  g.stroke()
  return {
    data: g.getImageData(0, 0, w, h),
    options: { pixelRatio: r, stretchX: [[10, w - 10]] as [number, number][], stretchY: [[10, h - 10]] as [number, number][], content: [12, 8, w - 12, h - 8] as [number, number, number, number] },
  }
}

type Feature = GeoJSON.Feature<GeoJSON.Point, { hid: string; label: string; sel: number; locked: number }>

export default function LeadsMap({ leads, selected, locked, hot, office, radius, onToggle, onHot }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const readyRef = useRef(false)
  const dataRef = useRef<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] })
  const indexRef = useRef(new Map<string, number>())
  const hotRef = useRef<{ fid: number | null; marker: maplibregl.Marker | null; el: HTMLDivElement | null }>({ fid: null, marker: null, el: null })
  const cb = useRef({ onToggle, onHot })
  useEffect(() => {
    cb.current = { onToggle, onHot }
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
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    if (office) {
      const pin = document.createElement('div')
      pin.setAttribute('aria-hidden', 'true')
      pin.innerHTML =
        `<svg class="${styles.pin}" viewBox="-19 -44 38 46"><ellipse cx="0" cy="0" rx="11" ry="3.5" fill="#1b2333" opacity=".18"/>` +
        `<path d="M0 0 C-4 -9 -18 -20 -18 -34 A18 18 0 0 1 18 -34 C18 -20 4 -9 0 0 Z" fill="${NAVY}"/>` +
        `<text x="0" y="-29.5" text-anchor="middle" fill="#fff" font-size="12" font-weight="700" font-family="var(--font-sans)">You</text></svg>`
      new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([office.lng, office.lat]).addTo(map)
    }

    // the one tag that follows the hovered home
    const hotEl = document.createElement('div')
    hotEl.className = styles.hotTag
    hotEl.setAttribute('aria-hidden', 'true')
    hotRef.current.el = hotEl
    hotRef.current.marker = new maplibregl.Marker({ element: hotEl, anchor: 'bottom', offset: [0, -10] })

    map.on('load', () => {
      const plain = tagImage('#ffffff', LINE_2)
      const picked = tagImage(ORANGE, ORANGE_DEEP)
      map.addImage('hp-tag', plain.data, plain.options)
      map.addImage('hp-tag-on', picked.data, picked.options)
      map.addSource('homes', { type: 'geojson', data: dataRef.current })
      // a wider invisible ring so homes are easy to tap
      map.addLayer({ id: 'homes-hit', type: 'circle', source: 'homes', paint: { 'circle-radius': 12, 'circle-opacity': 0 } })
      map.addLayer({
        id: 'homes-dot',
        type: 'circle',
        source: 'homes',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, ['case', ['boolean', ['feature-state', 'hot'], false], 6, 3],
            13, ['case', ['boolean', ['feature-state', 'hot'], false], 8, 5],
            16, ['case', ['boolean', ['feature-state', 'hot'], false], 10, 7],
          ],
          'circle-color': ['case', ['==', ['get', 'sel'], 1], ORANGE, ['==', ['get', 'locked'], 1], '#d6d1c6', '#ffffff'],
          'circle-stroke-color': ['case', ['boolean', ['feature-state', 'hot'], false], INK, ['==', ['get', 'sel'], 1], ORANGE_DEEP, NAVY],
          'circle-stroke-width': ['case', ['boolean', ['feature-state', 'hot'], false], 2.5, 1.5],
        },
      })
      map.addLayer({
        id: 'homes-tag',
        type: 'symbol',
        source: 'homes',
        minzoom: TAG_ZOOM,
        filter: ['!=', ['get', 'locked'], 1],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-anchor': 'bottom',
          'text-offset': [0, -0.95],
          'icon-image': ['case', ['==', ['get', 'sel'], 1], 'hp-tag-on', 'hp-tag'],
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [3, 7, 3, 7],
          'symbol-sort-key': ['case', ['==', ['get', 'sel'], 1], 0, 1],
          'text-padding': 2,
        },
        paint: { 'text-color': INK },
      })
      readyRef.current = true

      const pick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (f && f.properties?.locked !== 1) cb.current.onToggle(String(f.properties?.hid))
      }
      const hover = (e: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (f) cb.current.onHot(String(f.properties?.hid))
      }
      const leave = () => {
        map.getCanvas().style.cursor = ''
        cb.current.onHot(null)
      }
      for (const layer of ['homes-hit', 'homes-tag']) {
        map.on('click', layer, pick)
        map.on('mousemove', layer, hover)
        map.on('mouseleave', layer, leave)
      }
    })

    const box = boxRef.current
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(box)
    const hotState = hotRef.current
    return () => {
      ro.disconnect()
      hotState.marker?.remove()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // The map is created once; homes, distance and selection update it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // your patch: a dashed circle at the chosen distance, framed to fit
  useEffect(() => {
    const map = mapRef.current
    if (!map || !office) return
    const data: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(office.lat, office.lng, radius)] } }
    const apply = () => {
      const src = map.getSource('patch') as maplibregl.GeoJSONSource | undefined
      if (src) src.setData(data)
      else {
        map.addSource('patch', { type: 'geojson', data })
        const before = map.getLayer('homes-hit') ? 'homes-hit' : undefined
        map.addLayer({ id: 'patch-fill', type: 'fill', source: 'patch', paint: { 'fill-color': NAVY, 'fill-opacity': 0.04 } }, before)
        map.addLayer({ id: 'patch-line', type: 'line', source: 'patch', paint: { 'line-color': NAVY, 'line-opacity': 0.4, 'line-width': 1.5, 'line-dasharray': [3, 3] } }, before)
      }
      map.fitBounds(circleBounds(office.lat, office.lng, radius), { padding: 28, duration: 0 })
    }
    if (readyRef.current) apply()
    else map.once('load', apply)
  }, [office, radius])

  // homes, picks and locks: one GeoJSON update, drawn by the GPU
  useEffect(() => {
    const on = new Set(selected)
    const lockedSet = new Set(locked)
    const index = new Map<string, number>()
    const features: Feature[] = leads.map((l, i) => {
      index.set(l.id, i)
      return {
        type: 'Feature',
        id: i,
        geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
        properties: { hid: l.id, label: l.label, sel: on.has(l.id) ? 1 : 0, locked: lockedSet.has(l.id) ? 1 : 0 },
      }
    })
    indexRef.current = index
    dataRef.current = { type: 'FeatureCollection', features }
    const map = mapRef.current
    if (map && readyRef.current) {
      ;(map.getSource('homes') as maplibregl.GeoJSONSource | undefined)?.setData(dataRef.current)
      hotRef.current.fid = null
    }
  }, [leads, selected, locked])

  // hover, from the list or the map
  useEffect(() => {
    const map = mapRef.current
    const h = hotRef.current
    if (!map || !readyRef.current) return
    if (h.fid != null) map.setFeatureState({ source: 'homes', id: h.fid }, { hot: false })
    const fid = hot != null ? indexRef.current.get(hot) : undefined
    const lead = fid != null ? leads[fid] : undefined
    if (fid != null && lead) {
      map.setFeatureState({ source: 'homes', id: fid }, { hot: true })
      h.fid = fid
      if (h.el && h.marker) {
        h.el.textContent = lead.label
        h.el.classList.toggle(styles.hotOn, selected.includes(lead.id))
        h.marker.setLngLat([lead.lng, lead.lat]).addTo(map)
      }
    } else {
      h.fid = null
      h.marker?.remove()
    }
  }, [hot, leads, selected])

  return <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} aria-label="Map of these homes. Pick homes from the list, or tap a home on the map." role="region" />
}
