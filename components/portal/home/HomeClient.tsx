'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatAddressLine, formatPostcode } from '@/lib/address/format'
import { addressKey } from '@/lib/address/normalise'
import { formatDayMonth } from '@/lib/utils/date'
import { INCLUDED_POSTCARDS_PER_MONTH, POSTCARD_OVERAGE_PENCE } from '@/types/profile'
import { useSendFlow } from '@/components/postcards/SendFlow'
import AddAddressModal from '@/components/leads/AddAddressModal'
import type { MapLead } from './LeadsMap'
import s from './home.module.css'

const LeadsMap = dynamic(() => import('./LeadsMap'), { ssr: false })

export type HomeLead = {
  id: string
  addressLine: string
  postcode: string
  price: number | null // pence
  propertyType: string | null // D S T F O
  distance: number | null
  soldOn: string | null
  month: string
  selected: boolean
  jobId: string | null
  custom: boolean
  lat: number | null
  lng: number | null
}
export type Prefs = { radius: number; min: number | null; max: number | null; types: string[] }

const TYPES: [string, string][] = [['D', 'Detached'], ['S', 'Semi-detached'], ['T', 'Terraced'], ['F', 'Flat'], ['O', 'Other']]
const TYPE_NAME = Object.fromEntries(TYPES)
const DISTANCES = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50]
// Rightmove-style price steps, in pounds.
const PRICES = (() => {
  const a: number[] = []
  for (let v = 50000; v < 300000; v += 10000) a.push(v)
  return a.concat([300000, 325000, 350000, 375000, 400000, 425000, 450000, 475000, 500000, 550000, 600000, 650000, 700000, 800000, 900000,
    1000000, 1250000, 1500000, 1750000, 2000000, 2500000, 3000000, 4000000, 5000000, 7500000, 10000000, 15000000, 20000000])
})()
const UNSUBSCRIBED_LIMIT = 5

const pounds = (pence: number) => '£' + Math.round(pence / 100).toLocaleString('en-GB')
const shortPrice = (pence: number) => {
  const p = pence / 100
  if (p >= 1e6) return '£' + String(Math.round(p / 1e5) / 10).replace(/\.0$/, '') + 'm'
  return '£' + Math.round(p / 1000) + 'k'
}
const distLabel = (d: number) => `${d} ${d === 1 ? 'mile' : 'miles'}`
const priceText = (pence: number | null, isMax: boolean) => (pence ? '£' + Math.round(pence / 100).toLocaleString('en-GB') : isMax ? 'No max' : 'No min')
function parseDist(v: string): number | null {
  const n = Number(String(v).toLowerCase().replace(/miles?|mi\b/g, '').trim())
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : null
}
/** "450k", "£450,000", "1.2m" or "No min" → pence (0 means no limit), or null if unreadable. */
function parsePrice(v: string): number | null {
  const t = String(v).toLowerCase().replace(/[£,\s]/g, '')
  if (!t || t === 'nomin' || t === 'nomax' || t === 'any') return 0
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m)?$/)
  if (!m) return null
  let n = parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1)
  if (!m[2] && n < 1000) n *= 1000
  return Math.round(n) * 100
}
function matches(l: HomeLead, p: Prefs) {
  if (l.custom) return true // homes you added yourself always show
  if (l.distance != null && l.distance > p.radius) return false
  if (p.min && (l.price ?? 0) < p.min) return false
  if (p.max && (l.price ?? 0) > p.max) return false
  if (p.types.length && l.propertyType && !p.types.includes(l.propertyType)) return false
  return true
}
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
function dedupeByAddress(list: HomeLead[]) {
  const byKey = new Map<string, HomeLead>()
  for (const l of list) {
    const k = addressKey(l.addressLine, l.postcode)
    const e = byKey.get(k)
    if (!e || (!e.selected && l.selected)) byKey.set(k, l)
  }
  return [...byKey.values()]
}

type Sort = 'distance' | 'price-desc' | 'price-asc' | 'newest'
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
  const [applied, setApplied] = useState<Prefs>(props.prefs)
  const [fields, setFields] = useState(() => ({ dist: distLabel(props.prefs.radius), min: priceText(props.prefs.min, false), max: priceText(props.prefs.max, true) }))
  const [fieldErr, setFieldErr] = useState<{ field: string; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [finding, setFinding] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [trayOpen, setTrayOpen] = useState(false)
  const [face, setFace] = useState<'front' | 'back'>('front')
  const [hot, setHot] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('distance')
  const [showAdd, setShowAdd] = useState(false)
  const [archived, setArchived] = useState<{ open: boolean; list: Archived[] | null }>({ open: false, list: null })
  const previousJobLinks = useRef(new Map<string, string | null>())

  // a fresh server render (after a fetch, an added address or a restore) replaces the list
  useEffect(() => { setLeads(props.leads) }, [props.leads])

  // Review order → confirm → cool-off/cancel, shared with Tracking (unchanged).
  const sendFlow = useSendFlow({
    hasBackDesign: !!backUrl,
    onHeld: ({ orderId, leadIds }) => {
      setLeads((prev) => {
        previousJobLinks.current = new Map(prev.filter((l) => leadIds.includes(l.id)).map((l) => [l.id, l.jobId]))
        return prev.map((l) => (leadIds.includes(l.id) ? { ...l, jobId: orderId, selected: false } : l))
      })
      setTrayOpen(false)
    },
    onCancelled: ({ leadIds, reactivate }) => {
      setLeads((prev) => prev.map((l) => (leadIds.includes(l.id) ? { ...l, jobId: reactivate ? previousJobLinks.current.get(l.id) ?? null : null, selected: false } : l)))
    },
  })

  /* ---------- what shows ---------- */
  const active = useMemo(() => dedupeByAddress(leads.filter((l) => !l.jobId)), [leads])
  const latestMonth = useMemo(() => [...new Set(active.map((l) => l.month))].sort().pop() ?? '', [active])
  const visible = useMemo(() => active.filter((l) => matches(l, applied)), [active, applied])
  const sorter = (a: HomeLead, b: HomeLead) => {
    if (sort === 'price-desc') return (b.price ?? 0) - (a.price ?? 0)
    if (sort === 'price-asc') return (a.price ?? 0) - (b.price ?? 0)
    if (sort === 'newest') return Date.parse(b.soldOn ?? '0') - Date.parse(a.soldOn ?? '0')
    return (a.distance ?? Infinity) - (b.distance ?? Infinity)
  }
  const newList = visible.filter((l) => l.month === latestMonth).sort(sorter)
  const earlierList = visible.filter((l) => l.month !== latestMonth).sort(sorter)
  const allSelected = active.filter((l) => l.selected)
  const picked = visible.filter((l) => l.selected)

  // Before subscribing you can see and pick five homes; the rest are shown blurred.
  const lockedIds = useMemo(() => {
    if (subscribed) return new Set<string>()
    const open = new Set([...newList, ...earlierList].slice(0, UNSUBSCRIBED_LIMIT).map((l) => l.id))
    return new Set(visible.filter((l) => !open.has(l.id)).map((l) => l.id))
  }, [subscribed, newList, earlierList, visible])

  /* ---------- picking ---------- */
  async function setSelected(ids: string[], on: boolean) {
    if (!ids.length) return
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, selected: on } : l)))
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/leads/${id}/select`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected: on }) })
          .then((r) => r.ok)
          .catch(() => false)
      )
    )
    const failed = ids.filter((_, i) => !results[i])
    if (failed.length) {
      setLeads((prev) => prev.map((l) => (failed.includes(l.id) ? { ...l, selected: !on } : l)))
      toast.error(failed.length === 1 ? 'Could not update that home. Please try again.' : 'Some homes could not be updated. Please try again.')
    }
  }
  function toggle(id: string) {
    if (lockedIds.has(id)) return
    const lead = active.find((l) => l.id === id)
    if (!lead) return
    if (!lead.selected && !subscribed && allSelected.length >= UNSUBSCRIBED_LIMIT) {
      toast.message(`You can pick ${UNSUBSCRIBED_LIMIT} homes before subscribing.`)
      return
    }
    if (!lead.selected && picked.length === 0) setFace('back')
    void setSelected([id], !lead.selected)
  }
  function selectAll(list: HomeLead[]) {
    const open = list.filter((l) => !lockedIds.has(l.id))
    const allOn = open.length > 0 && open.every((l) => l.selected)
    if (allOn) return void setSelected(open.map((l) => l.id), false)
    let toPick = open.filter((l) => !l.selected)
    if (!subscribed) toPick = toPick.slice(0, Math.max(0, UNSUBSCRIBED_LIMIT - allSelected.length))
    if (picked.length === 0 && toPick.length) setFace('back')
    void setSelected(toPick.map((l) => l.id), true)
  }

  /* ---------- filters ---------- */
  const envKey = `hp-fetched:${userId}:${latestMonth}`
  function readEnvelope(): Prefs {
    try {
      const raw = window.localStorage.getItem(envKey)
      if (raw) return JSON.parse(raw) as Prefs
    } catch {}
    return saved // what the monthly fetch used
  }
  function applyField(field: 'dist' | 'min' | 'max', value: string) {
    if (field === 'dist') {
      const d = parseDist(value)
      if (d == null) return setFieldErr({ field, msg: 'Type a distance in whole miles, from 1 to 50.' })
      setApplied((p) => ({ ...p, radius: d }))
      setFields((f) => ({ ...f, dist: distLabel(d) }))
    } else {
      const v = parsePrice(value)
      if (v == null) return setFieldErr({ field, msg: 'Type a price like £450,000, 450k or 1.2m.' })
      const isMax = field === 'max'
      const lo = isMax ? applied.min : v
      const hi = isMax ? v : applied.max
      if (lo && hi && lo >= hi) return setFieldErr({ field, msg: 'The lowest price needs to be under the highest.' })
      setApplied((p) => ({ ...p, [isMax ? 'max' : 'min']: v || null }))
      setFields((f) => ({ ...f, [field]: priceText(v, isMax) }))
    }
    setFieldErr(null)
  }
  function onFieldInput(field: 'dist' | 'min' | 'max', value: string, options: string[]) {
    setFields((f) => ({ ...f, [field]: value }))
    if (options.includes(value)) applyField(field, value) // picked from the list
  }
  function toggleType(code: string, on: boolean) {
    const next = on ? [...applied.types, code] : applied.types.filter((t) => t !== code)
    if (!next.length) return setFieldErr({ field: 'types', msg: 'Pick at least one property type.' })
    setFieldErr(null)
    setApplied((p) => ({ ...p, types: next }))
  }
  function undo() {
    setApplied(saved)
    setFields({ dist: distLabel(saved.radius), min: priceText(saved.min, false), max: priceText(saved.max, true) })
    setFieldErr(null)
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
      if (reachesBeyond(applied, env)) {
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
    const res = await fetch('/api/leads/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
    if (!res.ok) return void toast.error('Could not archive those homes. Please try again.')
    setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
    setArchived((a) => ({ ...a, list: null }))
    toast.success(`${ids.length} ${ids.length === 1 ? 'home' : 'homes'} archived`)
  }
  async function toggleArchived() {
    if (archived.open) return setArchived((a) => ({ ...a, open: false }))
    setArchived((a) => ({ ...a, open: true }))
    if (archived.list) return
    const res = await fetch('/api/leads?archived=true')
    const data = res.ok ? await res.json() : { leads: [] }
    setArchived({ open: true, list: (data.leads ?? []) as Archived[] })
  }
  async function restore(id: string) {
    const res = await fetch('/api/leads/unarchive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
    if (!res.ok) return void toast.error('Could not restore that home. Please try again.')
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

  function renderRow(l: HomeLead) {
    const locked = lockedIds.has(l.id)
    const meta = [l.propertyType ? TYPE_NAME[l.propertyType] ?? 'Other' : null, l.distance != null ? `${l.distance.toFixed(1)} mi` : null, l.soldOn ? `Sold ${formatDayMonth(l.soldOn)}` : formatPostcode(l.postcode)]
      .filter(Boolean).join(' · ')
    return (
      <li key={l.id}>
        <label
          className={`${s.row} ${l.selected ? s.on : ''} ${hot === l.id ? s.hot : ''} ${locked ? s.locked : ''}`}
          onMouseEnter={() => setHot(l.id)}
          onMouseLeave={() => setHot((h) => (h === l.id ? null : h))}
          aria-disabled={locked || undefined}
        >
          <input
            className={s.cb}
            type="checkbox"
            checked={l.selected}
            disabled={locked}
            onChange={() => toggle(l.id)}
            aria-label={`${formatAddressLine(l.addressLine)}${l.price ? ', ' + pounds(l.price) : ''}`}
          />
          <span className={s.addr}>
            <span className={s.street}>{formatAddressLine(l.addressLine)}</span>
            <span className={s.meta}>{meta}</span>
          </span>
          <span className={s.price}>{l.price ? pounds(l.price) : ''}</span>
        </label>
      </li>
    )
  }
  function renderGroup(title: string, list: HomeLead[], sub?: string) {
    const open = list.filter((l) => !lockedIds.has(l.id))
    const allOn = open.length > 0 && open.every((l) => l.selected)
    return (
      <div className={s.group}>
        <div className={s.gHead}>
          <div><h2>{title}</h2>{sub && <p className={s.gSub}>{sub}</p>}</div>
          {open.length > 0 && <button type="button" className={s.textBtn} onClick={() => selectAll(list)}>{allOn ? 'Clear' : 'Select all'}</button>}
        </div>
        <ul className={s.rows}>
          {list.length ? list.map(renderRow) : <li className={s.empty}>No homes here match your filters. A wider distance or price range will bring more in.</li>}
        </ul>
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
            <label htmlFor="f-dist">Within</label>
            <input id="f-dist" className={`${s.inp} ${s.inpD} ${fieldErr?.field === 'dist' ? s.bad : ''}`} list="dl-dist" autoComplete="off" value={fields.dist}
              onChange={(e) => onFieldInput('dist', e.target.value, DISTANCES.map(distLabel))}
              onBlur={(e) => applyField('dist', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyField('dist', (e.target as HTMLInputElement).value) } }}
              onFocus={(e) => e.target.select()} />
          </div>
          <div className={s.fld}>
            <span id="f-price">Price</span>
            <div className={s.range}>
              <input className={`${s.inp} ${fieldErr?.field === 'min' ? s.bad : ''}`} list="dl-min" autoComplete="off" aria-label="Lowest price" value={fields.min}
                onChange={(e) => onFieldInput('min', e.target.value, ['No min', ...PRICES.map((p) => priceText(p * 100, false))])}
                onBlur={(e) => applyField('min', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyField('min', (e.target as HTMLInputElement).value) } }}
                onFocus={(e) => e.target.select()} />
              <span>to</span>
              <input className={`${s.inp} ${fieldErr?.field === 'max' ? s.bad : ''}`} list="dl-max" autoComplete="off" aria-label="Highest price" value={fields.max}
                onChange={(e) => onFieldInput('max', e.target.value, ['No max', ...PRICES.map((p) => priceText(p * 100, true))])}
                onBlur={(e) => applyField('max', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyField('max', (e.target as HTMLInputElement).value) } }}
                onFocus={(e) => e.target.select()} />
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
        </div>
        <datalist id="dl-dist">{DISTANCES.map((d) => <option key={d} value={distLabel(d)} />)}</datalist>
        <datalist id="dl-min"><option value="No min" />{PRICES.map((p) => <option key={p} value={priceText(p * 100, false)} />)}</datalist>
        <datalist id="dl-max"><option value="No max" />{PRICES.map((p) => <option key={p} value={priceText(p * 100, true)} />)}</datalist>
      </form>

      <section className={s.list} aria-label="Homes to choose">
        <div className={s.listTools}>
          <label htmlFor="home-sort">Sort by</label>
          <select id="home-sort" className={s.sort} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="distance">Nearest first</option>
            <option value="newest">Most recent sale</option>
            <option value="price-desc">Highest price</option>
            <option value="price-asc">Lowest price</option>
          </select>
        </div>
        {renderGroup('New this month', newList)}
        {earlierList.length > 0 && renderGroup('Earlier homes', earlierList, 'Not sent yet')}
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
            {archived.list == null && <li className={s.empty}>Loading…</li>}
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
