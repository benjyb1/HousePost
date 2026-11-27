'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatAddressLine, formatPostcode } from '@/lib/address/format'
import { addressKey } from '@/lib/address/normalise'
import { formatDayMonth } from '@/lib/utils/date'
import { INCLUDED_POSTCARDS_PER_MONTH, POSTCARD_OVERAGE_PENCE } from '@/types/profile'
import { matchesPrefs, PREVIEW_LIMIT } from '@/lib/leads/preview'
import { useSendFlow } from '@/components/postcards/SendFlow'
import AddAddressModal from '@/components/leads/AddAddressModal'
import type { MapLead } from './LeadsMap'
import { Picker } from './Picker'
import s from './home.module.css'

// Start fetching the map code as soon as this file loads, not after the page
// has hydrated, so the map is ready sooner after sign-in and on coming back.
const loadMap = () => import('./LeadsMap')
if (typeof window !== 'undefined') void loadMap()
const LeadsMap = dynamic(loadMap, { ssr: false, loading: () => <div className={s.mapWait}>Loading map…</div> })

export type HomeLead = {
  id: string
  addressLine: string
  postcode: string
  price: number | null // pence
  propertyType: string | null // D S T F O
  distance: number | null
  soldOn: string | null
  month: string
  jobId: string | null
  custom: boolean
  lat: number | null
  lng: number | null
  /** Before subscribing: a blank stand-in for a home the server didn't send. */
  locked?: boolean
}
export type Prefs = { radius: number; min: number | null; max: number | null; types: string[] }

/*
  Picked homes live in this browser tab's memory only. They are not saved to
  the server, so there are no per-home requests to fail half way through a
  "Select all", and they can't come back in a later session. They do survive
  moving between Home, Designs and Tracking; a reload or signing in again
  starts with nothing picked.
*/
const pickMemory: { userId: string | null; ids: Set<string> } = { userId: null, ids: new Set() }

const TYPES: [string, string][] = [['D', 'Detached'], ['S', 'Semi-detached'], ['T', 'Terraced'], ['F', 'Flat'], ['O', 'Other']]
const TYPE_NAME = Object.fromEntries(TYPES)
export const MAX_RADIUS = 10
const DISTANCES = [1, 2, 3, 5, 7, 10]
// Rightmove-style price steps, in pounds.
const PRICES = (() => {
  const a: number[] = []
  for (let v = 50000; v < 300000; v += 10000) a.push(v)
  return a.concat([300000, 325000, 350000, 375000, 400000, 425000, 450000, 475000, 500000, 550000, 600000, 650000, 700000, 800000, 900000,
    1000000, 1250000, 1500000, 1750000, 2000000, 2500000, 3000000, 4000000, 5000000, 7500000, 10000000, 15000000, 20000000])
})()
const UNSUBSCRIBED_LIMIT = PREVIEW_LIMIT

const pounds = (pence: number) => '£' + Math.round(pence / 100).toLocaleString('en-GB')
const shortPrice = (pence: number) => {
  const p = pence / 100
  if (p >= 1e6) return '£' + String(Math.round(p / 1e5) / 10).replace(/\.0$/, '') + 'm'
  return '£' + Math.round(p / 1000) + 'k'
}
const distLabel = (d: number) => `${d} ${d === 1 ? 'mile' : 'miles'}`
const priceText = (pence: number | null, isMax: boolean) => (pence ? '£' + Math.round(pence / 100).toLocaleString('en-GB') : isMax ? 'No max' : 'No min')
/** "450k", "£450,000" or "1.2m" → pence, or null if unreadable. */
function parsePrice(v: string): number | null {
  const t = String(v).toLowerCase().replace(/[£,\s]/g, '')
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m)?$/)
  if (!m) return null
  let n = parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1)
  if (!m[2] && n < 1000) n *= 1000
  return n > 0 ? Math.round(n) * 100 : null
}
/** Homes you added yourself always show; so do the locked stand-ins, which carry nothing to filter on. */
const matches = (l: HomeLead, p: Prefs) => !!l.locked || matchesPrefs(l, p)
const samePrefs = (a: Prefs, b: Prefs) =>
  a.radius === b.radius && (a.min ?? 0) === (b.min ?? 0) && (a.max ?? 0) === (b.max ?? 0) && [...a.types].sort().join() === [...b.types].sort().join()
/** Does `p` reach anywhere `env` didn't? Then this month's homes need fetching again. */
function reachesBeyond(p: Prefs, env: Prefs) {
  if (p.radius > env.radius) return true
  if ((p.min ?? 0) < (env.min ?? 0)) return true
  if (env.max && (!p.max || p.max > env.max)) return true
  return p.types.some((t) => !env.types.includes(t))
}
function widest(a: Prefs, b: Prefs): Prefs {
  return {
    radius: Math.max(a.radius, b.radius),
    min: Math.min(a.min ?? 0, b.min ?? 0) || null,
    max: !a.max || !b.max ? null : Math.max(a.max, b.max),
    types: [...new Set([...a.types, ...b.types])],
  }
}
/** The same home can turn up in more than one month; show it once (rows come newest month first). */
function dedupeByAddress(list: HomeLead[]) {
  const byKey = new Map<string, HomeLead>()
  const locked: HomeLead[] = []
  for (const l of list) {
    if (l.locked) {
      locked.push(l) // already one per address, and they have no address to compare
      continue
    }
    const k = addressKey(l.addressLine, l.postcode)
    if (!byKey.has(k)) byKey.set(k, l)
  }
  return [...byKey.values(), ...locked]
}

const PAGE_ROWS = 50

/** Made-up text shown blurred in place of a home you can't see yet. */
const STAND_INS: [string, string, string][] = [
  ['12 Hidden Road, Nearby', 'Semi-detached · 1.2 mi · Sold recently', '£000,000'],
  ['3 Somewhere Close, Near you', 'Terraced · 0.8 mi · Sold recently', '£000,000'],
  ['The Old House, Lane End', 'Detached · 2.4 mi · Sold recently', '£0,000,000'],
  ['Flat 4, 27 High Street', 'Flat · 1.6 mi · Sold recently', '£000,000'],
]

/** One home in the list. Memoised, so hovering one row doesn't redraw the others. */
const LeadRow = memo(function LeadRow({ lead: l, on, hot, locked, onToggle, onHot }: { lead: HomeLead; on: boolean; hot: boolean; locked: boolean; onToggle: (id: string) => void; onHot: (id: string | null) => void }) {
  if (l.locked) {
    // Stand-in text under the blur; the real home isn't on the page.
    const v = STAND_INS[(Number(l.id.replace(/\D/g, '')) || 0) % STAND_INS.length]
    return (
      <li>
        <div className={`${s.row} ${s.locked}`} aria-label="A home you can see once you subscribe" role="group">
          <input className={s.cb} type="checkbox" checked={false} disabled readOnly aria-hidden="true" tabIndex={-1} />
          <span className={s.addr} aria-hidden="true">
            <span className={s.street}>{v[0]}</span>
            <span className={s.meta}>{v[1]}</span>
          </span>
          <span className={s.price} aria-hidden="true">{v[2]}</span>
        </div>
      </li>
    )
  }
  const meta = [l.propertyType ? TYPE_NAME[l.propertyType] ?? 'Other' : null, l.distance != null ? `${l.distance.toFixed(1)} mi` : null, l.soldOn ? `Sold ${formatDayMonth(l.soldOn)}` : formatPostcode(l.postcode)]
    .filter(Boolean).join(' · ')
  const name = formatAddressLine(l.addressLine)
  return (
    <li>
      <label
        className={`${s.row} ${on ? s.on : ''} ${hot ? s.hot : ''} ${locked ? s.locked : ''}`}
        onMouseEnter={() => onHot(l.id)}
        onMouseLeave={() => onHot(null)}
        aria-disabled={locked || undefined}
      >
        <input className={s.cb} type="checkbox" checked={on} disabled={locked} onChange={() => onToggle(l.id)} aria-label={`${name}${l.price ? ', ' + pounds(l.price) : ''}`} />
        <span className={s.addr}>
          <span className={s.street}>{name}</span>
          <span className={s.meta}>{meta}</span>
        </span>
        <span className={s.price}>{l.price ? pounds(l.price) : ''}</span>
      </label>
    </li>
  )
})

type Sort = 'distance' | 'price-desc' | 'price-asc' | 'newest'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'distance', label: 'Nearest first' },
  { value: 'newest', label: 'Most recent sale' },
  { value: 'price-desc', label: 'Highest price' },
  { value: 'price-asc', label: 'Lowest price' },
]
type Archived = { id: string; address_line: string; postcode: string; price: number | null }

export function HomeClient(props: {
  userId: string
  leads: HomeLead[]
  prefs: Prefs
  office: { lat: number; lng: number } | null
  subscribed: boolean
  frontUrl: string | null
  backUrl: string | null
  used: number
}) {
  const { userId, office, subscribed, frontUrl, backUrl, used } = props
  const router = useRouter()
  const [leads, setLeads] = useState(props.leads)
  const [saved, setSaved] = useState<Prefs>(props.prefs)
  // Distance now stops at 10 miles; an older, wider saved search opens at 10.
  const [applied, setApplied] = useState<Prefs>(() => ({ ...props.prefs, radius: Math.min(props.prefs.radius, MAX_RADIUS) }))
  const [picks, setPicks] = useState<Set<string>>(() => (typeof window !== 'undefined' && pickMemory.userId === userId ? pickMemory.ids : new Set()))
  const [fieldErr, setFieldErr] = useState<{ field: string; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [finding, setFinding] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [trayOpen, setTrayOpen] = useState(false)
  const [face, setFace] = useState<'front' | 'back'>('front')
  const [hot, setHot] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('distance')
  const [showAdd, setShowAdd] = useState(false)
  const [archived, setArchived] = useState<{ open: boolean; list: Archived[] | null; failed?: boolean }>({ open: false, list: null })
  const previousJobLinks = useRef(new Map<string, string | null>())

  // a fresh server render (after a fetch, an added address or a restore) replaces the list
  useEffect(() => { setLeads(props.leads) }, [props.leads])
  // keep this tab's picks while moving between pages
  useEffect(() => {
    pickMemory.userId = userId
    pickMemory.ids = picks
  }, [userId, picks])

  // Review order → confirm → cool-off/cancel, shared with Tracking (unchanged).
  const sendFlow = useSendFlow({
    hasBackDesign: !!backUrl,
    onHeld: ({ orderId, leadIds }) => {
      setLeads((prev) => {
        previousJobLinks.current = new Map(prev.filter((l) => leadIds.includes(l.id)).map((l) => [l.id, l.jobId]))
        return prev.map((l) => (leadIds.includes(l.id) ? { ...l, jobId: orderId } : l))
      })
      unpick(leadIds)
      setTrayOpen(false)
      // Fetch this month's card count again, so the cost hint stays right.
      // Picks live in this tab's memory, so they survive the refresh.
      router.refresh()
    },
    onCancelled: ({ leadIds, reactivate }) => {
      setLeads((prev) => prev.map((l) => (leadIds.includes(l.id) ? { ...l, jobId: reactivate ? previousJobLinks.current.get(l.id) ?? null : null } : l)))
      router.refresh()
    },
  })

  /* ---------- what shows ---------- */
  const active = useMemo(() => dedupeByAddress(leads.filter((l) => !l.jobId)), [leads])
  const latestMonth = useMemo(() => [...new Set(active.map((l) => l.month))].sort().pop() ?? '', [active])
  const visible = useMemo(() => active.filter((l) => matches(l, applied)), [active, applied])
  const [newList, earlierList] = useMemo(() => {
    const sorter = (a: HomeLead, b: HomeLead) => {
      if (!!a.locked !== !!b.locked) return a.locked ? 1 : -1 // stand-ins always last
      if (sort === 'price-desc') return (b.price ?? 0) - (a.price ?? 0)
      if (sort === 'price-asc') return (a.price ?? 0) - (b.price ?? 0)
      if (sort === 'newest') return Date.parse(b.soldOn ?? '0') - Date.parse(a.soldOn ?? '0')
      return (a.distance ?? Infinity) - (b.distance ?? Infinity)
    }
    return [visible.filter((l) => l.month === latestMonth).sort(sorter), visible.filter((l) => l.month !== latestMonth).sort(sorter)]
  }, [visible, latestMonth, sort])
  // Long lists show 50 at a time per group.
  const [shown, setShown] = useState<Record<string, number>>({})

  // Before subscribing you can see and pick five homes; the server sends the
  // rest as blank stand-ins, shown blurred.
  const lockedIds = useMemo(() => {
    if (subscribed) return new Set<string>()
    return new Set(visible.filter((l) => l.locked).map((l) => l.id))
  }, [subscribed, visible])
  // What you've picked is only ever what you can see: a home the filters hide
  // is dropped from the picks (see changePrefs), so nothing is sent unseen.
  const picked = useMemo(() => visible.filter((l) => picks.has(l.id) && !lockedIds.has(l.id)), [visible, picks, lockedIds])
  const pickable = useMemo(() => visible.filter((l) => !lockedIds.has(l.id)), [visible, lockedIds])

  /* ---------- picking (all in memory, so it is instant and can't half-fail) ---------- */
  function pick(list: HomeLead[]) {
    const room = subscribed ? Infinity : Math.max(0, UNSUBSCRIBED_LIMIT - picked.length)
    const add = list.filter((l) => !lockedIds.has(l.id) && !picks.has(l.id)).slice(0, room)
    if (!add.length) {
      if (!subscribed && room === 0) toast.message(`You can pick ${UNSUBSCRIBED_LIMIT} homes before subscribing.`)
      return
    }
    if (picked.length === 0) setFace('back')
    setPicks((prev) => {
      const next = new Set(prev)
      for (const l of add) next.add(l.id)
      return next
    })
  }
  function unpick(ids: string[]) {
    setPicks((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }
  const clearAll = () => setPicks(new Set())
  function toggle(id: string) {
    if (lockedIds.has(id)) return
    const lead = visible.find((l) => l.id === id)
    if (!lead) return
    if (picks.has(id)) unpick([id])
    else pick([lead])
  }
  const toggleRef = useRef(toggle)
  useEffect(() => {
    toggleRef.current = toggle
  })
  const onToggle = useCallback((id: string) => toggleRef.current(id), [])
  const onHot = useCallback((id: string | null) => setHot(id), [])

  /* ---------- filters ---------- */
  const envKey = `hp-fetched:${userId}:${latestMonth}`
  function readEnvelope(): Prefs {
    try {
      const raw = window.localStorage.getItem(envKey)
      if (raw) return JSON.parse(raw) as Prefs
    } catch {}
    return saved // what the monthly fetch used
  }
  /** New filters; picked homes they now hide are let go, so widening again never brings picks back. */
  function changePrefs(next: Prefs) {
    setApplied(next)
    setFieldErr(null)
    setPicks((prev) => {
      if (!prev.size) return prev
      const keep = new Set<string>()
      for (const l of active) if (prev.has(l.id) && matches(l, next)) keep.add(l.id)
      return keep.size === prev.size ? prev : keep
    })
  }
  function setPrice(isMax: boolean, v: number) {
    const lo = isMax ? applied.min : v
    const hi = isMax ? v : applied.max
    if (lo && hi && lo >= hi) return setFieldErr({ field: isMax ? 'max' : 'min', msg: 'The lowest price needs to be under the highest.' })
    changePrefs({ ...applied, [isMax ? 'max' : 'min']: v || null })
  }
  function toggleType(code: string, on: boolean) {
    const next = on ? [...applied.types, code] : applied.types.filter((t) => t !== code)
    if (!next.length) return setFieldErr({ field: 'types', msg: 'Pick at least one property type.' })
    changePrefs({ ...applied, types: next })
  }
  function undo() {
    changePrefs({ ...saved, radius: Math.min(saved.radius, MAX_RADIUS) })
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (fieldErr || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_radius_miles: applied.radius, min_price: applied.min, max_price: applied.max, property_types: applied.types }),
      })
      if (!res.ok) throw new Error('save failed')
      const env = readEnvelope()
      setSaved(applied)
      setFiltersOpen(false)
      // Wider than anything fetched this month? Fetch the extra homes now.
      // (Subscribers only: before subscribing you see five homes either way.)
      if (subscribed && reachesBeyond(applied, env)) {
        setFinding(true)
        const r = await fetch('/api/leads/refresh', { method: 'POST' })
        if (r.ok) {
          try { window.localStorage.setItem(envKey, JSON.stringify(widest(env, applied))) } catch {}
          router.refresh()
        } else {
          toast.error('Saved. We could not fetch more homes just now, so the wider search starts with next month’s homes.')
        }
      }
    } catch {
      toast.error('Could not save your filters. Please try again.')
    } finally {
      setSaving(false)
      setFinding(false)
    }
  }
  const dirty = !samePrefs(applied, saved)

  /* ---------- archive and add ---------- */
  async function archivePicked() {
    const ids = picked.map((l) => l.id)
    if (!ids.length) return
    try {
      const res = await fetch('/api/leads/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      return void toast.error('Could not archive those homes. Please try again.')
    }
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
    unpick(ids)
    setArchived((a) => ({ ...a, list: null }))
    toast.success(`${ids.length} ${ids.length === 1 ? 'home' : 'homes'} archived`)
  }
  async function loadArchived() {
    setArchived({ open: true, list: null, failed: false })
    try {
      const res = await fetch('/api/leads?archived=true')
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setArchived({ open: true, list: (data.leads ?? []) as Archived[], failed: false })
    } catch {
      setArchived({ open: true, list: null, failed: true })
    }
  }
  async function toggleArchived() {
    if (archived.open) return setArchived((a) => ({ ...a, open: false }))
    if (archived.list) return setArchived((a) => ({ ...a, open: true }))
    await loadArchived()
  }
  async function restore(id: string) {
    try {
      const res = await fetch('/api/leads/unarchive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      return void toast.error('Could not restore that home. Please try again.')
    }
    setArchived((a) => ({ ...a, list: (a.list ?? []).filter((l) => l.id !== id) }))
    router.refresh()
  }

  /* ---------- checkout ---------- */
  const left = Math.max(0, INCLUDED_POSTCARDS_PER_MONTH - used)
  const n = picked.length
  const extra = Math.max(0, n - left)
  const extraCost = '£' + ((extra * POSTCARD_OVERAGE_PENCE) / 100).toFixed(2)
  const costTitle = !n ? 'No homes picked' : extra ? `${n} cards, ${extraCost} extra` : `${n} ${n === 1 ? 'card' : 'cards'}`
  const costSub = !n
    ? left ? `${left} included ${left === 1 ? 'card' : 'cards'} left this month` : `All ${INCLUDED_POSTCARDS_PER_MONTH} included cards used. Extra cards are £1.50 each.`
    : extra ? `${left ? `${left} included, then ` : ''}${extra} at £1.50 each` : 'Included in your plan, no extra cost'
  const busy = sendFlow.sendState !== 'idle'
  const send = () => { if (n && !busy) void sendFlow.beginSend(picked.map((l) => l.id)) }

  const mapLeads: MapLead[] = useMemo(
    () => visible.filter((l) => l.lat != null && l.lng != null).map((l) => ({
      id: l.id, lat: l.lat as number, lng: l.lng as number,
      label: l.price ? shortPrice(l.price) : 'Home',
      title: `${formatAddressLine(l.addressLine)}${l.price ? ', ' + pounds(l.price) : ''}`,
    })),
    [visible]
  )
  const pickedIds = useMemo(() => picked.map((l) => l.id), [picked])
  const lockedList = useMemo(() => [...lockedIds], [lockedIds])

  function renderGroup(key: string, title: string, list: HomeLead[], sub?: string) {
    const open = list.filter((l) => !lockedIds.has(l.id))
    const onCount = open.filter((l) => picks.has(l.id)).length
    const allOn = open.length > 0 && onCount === open.length
    const limit = shown[key] ?? PAGE_ROWS
    const rest = list.length - limit
    return (
      <div className={s.group}>
        <div className={s.gHead}>
          <div>
            <h2>{title}</h2>
            <p className={s.gSub}>
              {list.length === 1 ? '1 home' : `${list.length.toLocaleString('en-GB')} homes`}
              {onCount > 0 ? ` · ${onCount.toLocaleString('en-GB')} picked` : sub ? ` · ${sub}` : ''}
            </p>
          </div>
          {open.length > 0 && (
            <div className={s.gActs}>
              {!allOn && <button type="button" className={s.textBtn} onClick={() => pick(list)}>Select all</button>}
              {onCount > 0 && <button type="button" className={s.textBtn} onClick={() => unpick(list.map((l) => l.id))}>Clear</button>}
            </div>
          )}
        </div>
        <ul className={s.rows}>
          {list.length
            ? list.slice(0, limit).map((l) => (
                <LeadRow key={l.id} lead={l} on={picks.has(l.id)} hot={hot === l.id} locked={lockedIds.has(l.id)} onToggle={onToggle} onHot={onHot} />
              ))
            : <li className={s.empty}>No homes here match your filters. A wider distance or price range will bring more in.</li>}
        </ul>
        {rest > 0 && (
          <div className={s.showMore}>
            <button type="button" className={s.textBtn} onClick={() => setShown((m) => ({ ...m, [key]: limit + PAGE_ROWS }))}>Show {Math.min(PAGE_ROWS, rest)} more</button>
            {rest > PAGE_ROWS && <button type="button" className={s.textBtn} onClick={() => setShown((m) => ({ ...m, [key]: list.length }))}>Show all {list.length.toLocaleString('en-GB')}</button>}
          </div>
        )}
      </div>
    )
  }

  const isPdf = (u: string) => /\.pdf(\?|#|$)/i.test(u)
  const faceUrl = face === 'front' ? frontUrl : backUrl
  const filterIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
  )

  const card = (
    <div className={s.card}>
      <div className={s.scTop}>
        <div>
          <span className={s.scLabel}>Your card<Link href="/postcards/design">Change</Link></span>
          <span className={s.scName}>{frontUrl ? 'Ready to send' : 'No design yet'}</span>
        </div>
        <div className={s.seg} role="group" aria-label="Preview side">
          <button type="button" aria-pressed={face === 'front'} onClick={() => setFace('front')}>Front</button>
          <button type="button" aria-pressed={face === 'back'} onClick={() => setFace('back')}>Back</button>
        </div>
      </div>
      <div className={s.face}>
        {faceUrl ? (
          isPdf(faceUrl) ? <iframe src={`${faceUrl}#toolbar=0&view=Fit`} title={`Your card, ${face}`} /> : <img src={faceUrl} alt={`Your card, ${face}`} />
        ) : (
          <div className={s.faceEmpty}>
            <div>{face === 'front' ? 'No front design yet.' : 'No back design yet.'}<Link href="/postcards/design">{face === 'front' ? 'Make your card' : 'Add a back'}</Link></div>
          </div>
        )}
      </div>
      <div className={s.cap}>
        <p>{n ? `Going to ${formatAddressLine(picked[n - 1].addressLine)}${n > 1 ? ` and ${n - 1} more` : ''}.` : 'Each card goes to a home you pick.'}</p>
        <button type="button" className={`${s.textBtn} ${s.trayClose}`} onClick={() => setTrayOpen(false)}>Hide</button>
      </div>
      <div className={`${s.allow} ${s.deskOnly}`}>
        <div className={s.allowTop}><span>Included cards this month</span><b>{Math.min(INCLUDED_POSTCARDS_PER_MONTH, used + n)} of {INCLUDED_POSTCARDS_PER_MONTH}</b></div>
        <div className={s.meter} aria-hidden="true">
          {Array.from({ length: INCLUDED_POSTCARDS_PER_MONTH }, (_, i) => <i key={i} className={i < used ? s.used : i < used + n ? s.pick : ''} />)}
          {extra > 0 && <span className={s.extra}>+{extra} extra</span>}
        </div>
      </div>
      <div className={`${s.cost} ${s.deskOnly}`}><b>{costTitle}</b><span>{costSub}</span></div>
      {subscribed ? (
        <button type="button" className={`${s.btn} ${s.sendBtn} ${s.deskOnly}`} disabled={!n || busy} onClick={send}>
          {n ? `Send ${n} ${n === 1 ? 'card' : 'cards'}` : 'Send cards'}
        </button>
      ) : (
        <Link className={`${s.btn} ${s.sendBtn} ${s.deskOnly}`} href="/billing">Subscribe to send cards</Link>
      )}
    </div>
  )

  return (
    <div className={`${s.app} ${trayOpen ? s.trayOpen : ''}`}>
      <div className={s.head}>
        <h1>Home</h1>
        <button type="button" className={`${s.btn} ${s.btnSm} ${s.ghost} ${s.fOpen}`} aria-expanded={filtersOpen} aria-controls="home-filters" onClick={() => setFiltersOpen((o) => !o)}>
          {filterIcon}Filters
        </button>
      </div>

      <form id="home-filters" className={`${s.filters} ${filtersOpen ? '' : s.filtersClosed}`} onSubmit={save} noValidate aria-label="Filters">
        <div className={s.fbar}>
          <div className={s.fld}>
            <span>Within</span>
            <Picker
              label="Distance"
              display={distLabel(applied.radius)}
              value={applied.radius}
              options={DISTANCES.map((d) => ({ value: d, label: distLabel(d) }))}
              onChange={(d) => changePrefs({ ...applied, radius: d })}
            />
          </div>
          <div className={s.fld}>
            <span>Price</span>
            <div className={s.range}>
              <Picker
                label="Lowest price"
                display={priceText(applied.min, false)}
                value={applied.min ?? 0}
                options={[{ value: 0, label: 'No min' }, ...PRICES.map((p) => ({ value: p * 100, label: priceText(p * 100, false), disabled: !!applied.max && p * 100 >= applied.max }))]}
                onChange={(v) => setPrice(false, v)}
                custom={{ placeholder: 'Or type one, e.g. 450k', parse: parsePrice, error: 'Try a price like 450k, £450,000 or 1.2m.' }}
                wide
              />
              <span>to</span>
              <Picker
                label="Highest price"
                display={priceText(applied.max, true)}
                value={applied.max ?? 0}
                options={[{ value: 0, label: 'No max' }, ...PRICES.map((p) => ({ value: p * 100, label: priceText(p * 100, true), disabled: !!applied.min && p * 100 <= applied.min }))]}
                onChange={(v) => setPrice(true, v)}
                custom={{ placeholder: 'Or type one, e.g. 450k', parse: parsePrice, error: 'Try a price like 450k, £450,000 or 1.2m.' }}
                wide
              />
            </div>
          </div>
          <div className={s.fld}>
            <span>Property type</span>
            <div className={s.types}>
              {TYPES.map(([code, name]) => (
                <label key={code} className={s.tog}>
                  <input type="checkbox" checked={applied.types.includes(code)} onChange={(e) => toggleType(code, e.target.checked)} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className={s.fActs}>
            {dirty && <button type="button" className={s.textBtn} onClick={undo}>Undo changes</button>}
            <button type="submit" className={`${s.btn} ${s.btnSm}`} disabled={!dirty || saving || !!fieldErr}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
          {fieldErr && <p className={s.fErr} role="alert">{fieldErr.msg}</p>}
          {saved.radius > MAX_RADIUS && !fieldErr && (
            <p className={s.fNote}>Searches now go up to {MAX_RADIUS} miles. Save to change yours from {saved.radius} miles.</p>
          )}
        </div>
      </form>

      <section className={s.list} aria-label="Homes to choose">
        <div className={s.listTools}>
          <div className={s.pickBar} aria-live="polite">
            <b>{picked.length ? `${picked.length.toLocaleString('en-GB')} picked` : 'None picked'}</b>
            {pickable.length > 0 && picked.length < pickable.length && (
              <button type="button" className={s.textBtn} onClick={() => pick(pickable)}>
                Select all {pickable.length.toLocaleString('en-GB')}
              </button>
            )}
            {picked.length > 0 && <button type="button" className={s.textBtn} onClick={clearAll}>Clear all</button>}
          </div>
          <div className={s.sortBy}>
            <span>Sort by</span>
            <Picker label="Sort by" display={SORTS.find((o) => o.value === sort)?.label ?? ''} value={sort} options={SORTS} onChange={setSort} small />
          </div>
        </div>
        {renderGroup('new', 'New this month', newList)}
        {earlierList.length > 0 && renderGroup('earlier', 'Earlier homes', earlierList, 'not sent yet')}
        {!subscribed && lockedIds.size > 0 && (
          <p className={s.subscribe}>You can see and pick five homes for now. <Link href="/billing">Subscribe</Link> to see every home near you.</p>
        )}
        <div className={s.more}>
          {picked.length > 0 && <button type="button" className={s.textBtn} onClick={archivePicked}>Archive picked homes</button>}
          <button type="button" className={s.textBtn} onClick={() => setShowAdd(true)}>Add an address</button>
          <button type="button" className={s.textBtn} onClick={toggleArchived} aria-expanded={archived.open}>{archived.open ? 'Hide archived homes' : 'Archived homes'}</button>
        </div>
        {archived.open && (
          <ul className={`${s.rows} ${s.archived}`}>
            {archived.list == null && !archived.failed && <li className={s.empty}>Loading…</li>}
            {archived.failed && (
              <li className={s.empty} role="alert">
                Could not load your archived homes. <button type="button" className={s.textBtn} onClick={loadArchived}>Try again</button>
              </li>
            )}
            {archived.list?.length === 0 && <li className={s.empty}>Nothing archived.</li>}
            {archived.list?.map((a) => (
              <li key={a.id}>
                <div className={s.row}>
                  <span className={s.addr}><span className={s.street}>{formatAddressLine(a.address_line)}</span><span className={s.meta}>{formatPostcode(a.postcode)}{a.price ? ` · ${pounds(a.price)}` : ''}</span></span>
                  <button type="button" className={s.textBtn} onClick={() => restore(a.id)}>Restore</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={s.map} aria-label="Map">
        <LeadsMap leads={mapLeads} selected={pickedIds} locked={lockedList} hot={hot} office={office} radius={applied.radius} onToggle={toggle} onHot={setHot} />
      </section>

      <div className={s.dock}>
        <aside className={s.aside} aria-label="Your card and sending">{card}</aside>
        <div className={s.sendbar}>
          <button type="button" className={s.thumb} aria-expanded={trayOpen} aria-label={trayOpen ? 'Hide card preview' : 'Show card preview'} onClick={() => setTrayOpen((o) => !o)}>
            <span className={s.face} style={{ display: 'block' }}>{frontUrl && !isPdf(frontUrl) ? <img src={frontUrl} alt="" /> : null}</span>
          </button>
          <div className={s.sbText}>
            <b>{n ? `${n} ${n === 1 ? 'home' : 'homes'} picked` : 'No homes picked'}</b>
            <span>{!n ? (left ? `${left} included ${left === 1 ? 'card' : 'cards'} left` : 'Extra cards £1.50 each') : extra ? `${extraCost} extra, ${extra} over your ${INCLUDED_POSTCARDS_PER_MONTH}` : 'Included in your plan'}</span>
          </div>
          {subscribed
            ? <button type="button" className={s.btn} disabled={!n || busy} onClick={send}>{n ? `Send ${n}` : 'Send'}</button>
            : <Link className={s.btn} href="/billing">Subscribe</Link>}
        </div>
      </div>

      {sendFlow.dialogs}
      <AddAddressModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); router.refresh() }} />
      {finding && <div className={s.busy} role="status">Finding homes near you…</div>}
    </div>
  )
}
