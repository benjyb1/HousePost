'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { formatPricePence, formatDayMonth, formatMonthKey } from '@/lib/utils/date'
import { formatAddressLine, formatPostcode } from '@/lib/address/format'
import { addressKey } from '@/lib/address/normalise'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { INCLUDED_POSTCARDS_PER_MONTH, POSTCARD_OVERAGE_PENCE } from '@/types/profile'
import { useSendFlow } from '@/components/postcards/SendFlow'
import { FailedPostcardsNotice } from '@/components/dashboard/FailedPostcardsNotice'
import { PreferencesPanel, type Prefs } from './PreferencesPanel'
import styles from '../portal.module.css'

const HomesMap = dynamic(() => import('./HomesMap').then((m) => m.HomesMap), {
  ssr: false,
  loading: () => <div className={styles.mapWrap} aria-busy="true" />,
})

export type HomeLead = {
  id: string
  address_line: string
  postcode: string
  price: number | null
  property_type: string | null
  distance_miles: number | null
  date_of_transfer: string | null
  selected_for_dispatch: boolean
  lead_month: string
  lat: number | null
  lng: number | null
}

type Props = {
  leads: HomeLead[]
  subscriptionStatus: string
  usedThisPeriod: number
  prefs: Prefs
  office: { postcode: string | null; lat: number | null; lng: number | null }
  design: { front: string | null; back: string | null }
  delayedCount: number
  failed: { count: number; latestAt: string }
}

const EARLIER_SHOWN = 8
const FREE_PREVIEW = 5 // homes shown to people without an active subscription

// One row per address: "1 TOLPUDDLE ST" and "1 TOLPUDDLE STREET" are the same
// home and must never show (or bill) twice. Keep a picked one if there is one.
function dedupe(list: HomeLead[]) {
  const byKey = new Map<string, HomeLead>()
  for (const l of list) {
    const key = addressKey(l.address_line, l.postcode)
    const existing = byKey.get(key)
    if (!existing || (!existing.selected_for_dispatch && l.selected_for_dispatch)) byKey.set(key, l)
  }
  return [...byKey.values()]
}

function typeLabel(code: string | null) {
  if (!code) return 'Other'
  return PROPERTY_TYPE_LABELS[code as keyof typeof PROPERTY_TYPE_LABELS] ?? 'Other'
}

/** £685k, £1.24m: short enough for a map label. */
function shortPrice(pence: number) {
  const pounds = pence / 100
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m`
  return `£${Math.round(pounds / 1000)}k`
}

function nextMonthName() {
  const now = new Date()
  // New homes arrive early each month; after that, the next lot is next month's.
  const m = now.getDate() >= 6 ? now.getMonth() + 1 : now.getMonth()
  return new Date(now.getFullYear(), m, 1).toLocaleDateString('en-GB', { month: 'long' })
}

export function HomeView({ leads: initial, subscriptionStatus, usedThisPeriod, prefs, office, design, delayedCount, failed }: Props) {
  const [leads, setLeads] = useState(initial)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [showAllEarlier, setShowAllEarlier] = useState(false)
  const held = useRef<Map<string, HomeLead>>(new Map())

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  // Review, confirm, then the 15-minute cancel window: the same flow as the
  // All homes page and Tracking. Held homes leave the list; a cancel puts them back.
  const sendFlow = useSendFlow({
    hasBackDesign: Boolean(design.back),
    onHeld: ({ leadIds }) => {
      setLeads((prev) => {
        held.current = new Map(prev.filter((l) => leadIds.includes(l.id)).map((l) => [l.id, l]))
        return prev.filter((l) => !leadIds.includes(l.id))
      })
    },
    onCancelled: ({ leadIds }) => {
      const back = leadIds.map((id) => held.current.get(id)).filter((l): l is HomeLead => !!l)
      setLeads((prev) => [...prev, ...back.map((l) => ({ ...l, selected_for_dispatch: false }))])
    },
  })

  const all = dedupe(leads)
  const latestMonth = [...new Set(all.map((l) => l.lead_month))].sort().pop()
  const byDistance = (a: HomeLead, b: HomeLead) => (a.distance_miles ?? 99) - (b.distance_miles ?? 99)
  let newHomes = all.filter((l) => l.lead_month === latestMonth).sort(byDistance)
  let earlier = all.filter((l) => l.lead_month !== latestMonth).sort((a, b) => b.lead_month.localeCompare(a.lead_month) || byDistance(a, b))

  // Without a subscription people see a few homes, and the rest stay locked.
  let lockedCount = 0
  if (!isSubscribed) {
    const total = newHomes.length + earlier.length
    newHomes = newHomes.slice(0, FREE_PREVIEW)
    earlier = earlier.slice(0, Math.max(0, FREE_PREVIEW - newHomes.length))
    lockedCount = total - newHomes.length - earlier.length
  }
  const visible = [...newHomes, ...earlier]
  const picked = visible.filter((l) => l.selected_for_dispatch)

  async function setSelected(ids: string[], value: boolean) {
    if (ids.length === 0) return
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, selected_for_dispatch: value } : l)))
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/leads/${id}/select`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected: value }),
        })
          .then((r) => r.ok)
          .catch(() => false)
      )
    )
    const failedIds = ids.filter((_, i) => !results[i])
    if (failedIds.length) {
      // Roll back so a tick can't silently disagree with what's saved.
      setLeads((prev) => prev.map((l) => (failedIds.includes(l.id) ? { ...l, selected_for_dispatch: !value } : l)))
      toast.error('Some of those homes could not be updated. Please try again.')
    }
  }

  // ----- the money side, in the same terms as the order review -----
  const included = INCLUDED_POSTCARDS_PER_MONTH
  const includedLeft = Math.max(0, included - usedThisPeriod)
  const includedApplied = Math.min(picked.length, includedLeft)
  const extra = picked.length - includedApplied
  const extraCost = formatPricePence(extra * POSTCARD_OVERAGE_PENCE)
  const busy = sendFlow.sendState !== 'idle'
  const cardsWord = (n: number) => `${n} card${n === 1 ? '' : 's'}`

  const costTitle = picked.length === 0 ? 'No homes picked' : cardsWord(picked.length)
  const costLine =
    picked.length === 0
      ? includedLeft > 0
        ? `${includedLeft} included ${includedLeft === 1 ? 'card' : 'cards'} left this month`
        : 'Your included cards are used. Extra cards are £1.50 each'
      : extra === 0
        ? 'All included in your plan'
        : `${includedApplied} included, ${extra} extra at £1.50: ${extraCost}`

  const sendButton = (cls: string) =>
    isSubscribed ? (
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSend} ${cls}`}
        disabled={picked.length === 0 || busy}
        onClick={() => sendFlow.beginSend(picked.map((l) => l.id))}
      >
        {picked.length ? `Send ${cardsWord(picked.length)}` : 'Send cards'}
      </button>
    ) : (
      <Link href="/billing" className={`${styles.btn} ${cls}`}>
        Subscribe to send
      </Link>
    )

  const viewSwitch = (extraClass = '') => (
    <div className={`${styles.seg} ${styles.viewSwitch} ${extraClass}`} role="group" aria-label="Show homes as">
      <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
        List
      </button>
      <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
        Map
      </button>
    </div>
  )

  const row = (l: HomeLead) => (
    <li key={l.id}>
      <label className={`${styles.row} ${l.selected_for_dispatch ? styles.rowOn : ''}`}>
        <input
          type="checkbox"
          className={styles.cb}
          checked={l.selected_for_dispatch}
          disabled={busy}
          onChange={(e) => setSelected([l.id], e.target.checked)}
        />
        <span className={styles.addr}>
          <span className={styles.street}>{formatAddressLine(l.address_line)}</span>
          <span className={styles.meta}>
            {formatPostcode(l.postcode)}
            {l.date_of_transfer ? ` · Sold ${formatDayMonth(l.date_of_transfer)}` : ''}
            <span className={styles.mInline}>
              {` · ${typeLabel(l.property_type)}`}
              {l.distance_miles != null ? ` · ${l.distance_miles.toFixed(1)} mi` : ''}
            </span>
          </span>
        </span>
        <span className={styles.type}>{typeLabel(l.property_type)}</span>
        <span className={styles.dist}>{l.distance_miles != null ? `${l.distance_miles.toFixed(1)} mi` : ''}</span>
        <span className={styles.price}>{l.price != null ? formatPricePence(l.price) : ''}</span>
      </label>
    </li>
  )

  const group = (title: string, sub: string, list: HomeLead[], limit?: number) => {
    const shown = limit != null ? list.slice(0, limit) : list
    const allOn = list.length > 0 && list.every((l) => l.selected_for_dispatch)
    return (
      <div className={styles.group}>
        <div className={styles.gHead}>
          <div>
            <h2>
              {title}
              <span className={styles.n}>{list.length}</span>
            </h2>
            <p className={styles.gSub}>{sub}</p>
          </div>
          {list.length > 1 && (
            <button
              type="button"
              className={styles.textBtn}
              disabled={busy}
              onClick={() => setSelected(list.filter((l) => l.selected_for_dispatch === allOn).map((l) => l.id), !allOn)}
            >
              {allOn ? 'Clear' : 'Select all'}
            </button>
          )}
        </div>
        <div className={styles.cols} aria-hidden="true">
          <span />
          <span>Address</span>
          <span>Type</span>
          <span className={styles.right}>Distance</span>
          <span className={styles.right}>Price</span>
        </div>
        <ul className={styles.rows}>{shown.map(row)}</ul>
        {limit != null && list.length > limit && (
          <button type="button" className={`${styles.textBtn} ${styles.more}`} onClick={() => setShowAllEarlier(true)}>
            Show all {list.length}
          </button>
        )}
      </div>
    )
  }

  const mapHomes = visible
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => ({
      id: l.id,
      lat: l.lat as number,
      lng: l.lng as number,
      label: l.price != null ? shortPrice(l.price) : '',
      address: `${formatAddressLine(l.address_line)}, ${formatPostcode(l.postcode)}`,
      picked: l.selected_for_dispatch,
    }))
  const unmapped = visible.length - mapHomes.length

  return (
    <div className={styles.app}>
      <div className={styles.head}>
        {(delayedCount > 0 || failed.count > 0) && (
          <div className={styles.notices}>
            {delayedCount > 0 && (
              <Link href="/postcards" className={styles.notice}>
                <strong>
                  {delayedCount} postcard{delayedCount === 1 ? '' : 's'} delayed
                </strong>{' '}
                by a temporary problem on our side. They will be sent automatically.
              </Link>
            )}
            {failed.count > 0 && <FailedPostcardsNotice count={failed.count} latestFailedAt={failed.latestAt} />}
          </div>
        )}
        <h1 className={styles.title}>Home</h1>
        <p className={styles.when}>
          {office.postcode ? `Homes sold near ${formatPostcode(office.postcode)}. ` : ''}
          The next ones arrive in {nextMonthName()}.
        </p>
      </div>

      <section className={styles.prefsArea} aria-label="Your preferences">
        <PreferencesPanel initial={prefs} />
      </section>

      <section className={styles.listArea} aria-label="Homes to choose">
        {viewSwitch(styles.mOnly)}
        {view === 'list' ? (
          <>
            {visible.length === 0 && lockedCount === 0 && (
              <p className={styles.empty}>No homes waiting for a card. New ones arrive in {nextMonthName()}.</p>
            )}
            {newHomes.length > 0 &&
              group('New this month', latestMonth ? `Sold and recorded in ${formatMonthKey(latestMonth)}` : '', newHomes)}
            {earlier.length > 0 &&
              group('Earlier, not yet sent', 'From previous months', earlier, showAllEarlier ? undefined : EARLIER_SHOWN)}
            {lockedCount > 0 && (
              <p className={styles.locked}>
                {lockedCount} more home{lockedCount === 1 ? '' : 's'} near you. <Link href="/billing">Subscribe to see them all</Link>.
              </p>
            )}
          </>
        ) : (
          <>
            <HomesMap
              office={office.lat != null && office.lng != null ? { lat: office.lat, lng: office.lng } : null}
              homes={mapHomes}
              onToggle={(id, value) => !busy && setSelected([id], value)}
            />
            {unmapped > 0 && (
              <p className={styles.mapNote}>
                {unmapped} home{unmapped === 1 ? ' has' : 's have'} no map position yet. You&apos;ll find {unmapped === 1 ? 'it' : 'them'} in the list.
              </p>
            )}
          </>
        )}
        <Link href="/leads" className={styles.allLink}>
          All homes, including sent and archived
        </Link>
      </section>

      <aside className={styles.aside} aria-label="Your card and sending">
        {viewSwitch()}
        <div className={styles.sendcard}>
          <div className={styles.scTop}>
            <div>
              <span className={styles.scLabel}>Your card</span>
              <span className={styles.scDesign}>
                {side === 'front' ? 'Front' : 'Back'}
                <Link href="/postcards/design">Change</Link>
              </span>
            </div>
            <div className={`${styles.seg} ${styles.segSm}`} role="group" aria-label="Show the front or back">
              <button type="button" aria-pressed={side === 'front'} onClick={() => setSide('front')}>
                Front
              </button>
              <button type="button" aria-pressed={side === 'back'} onClick={() => setSide('back')}>
                Back
              </button>
            </div>
          </div>
          <CardFace url={side === 'front' ? design.front : design.back} side={side} />

          <div className={styles.allow}>
            <div className={styles.allowTop}>
              <span>Included this month</span>
              <b>
                {Math.min(included, usedThisPeriod + picked.length)} of {included}
              </b>
            </div>
            <div className={styles.meter} aria-hidden="true">
              {Array.from({ length: included }, (_, i) => (
                <i key={i} className={i < usedThisPeriod ? styles.used : i < usedThisPeriod + picked.length ? styles.pick : ''} />
              ))}
              {extra > 0 && <span className={styles.extra}>+{extra}</span>}
            </div>
          </div>

          <div className={styles.cost}>
            <b>{costTitle}</b>
            <span>{costLine}</span>
          </div>
          {sendButton(styles.sendBtn)}
          <p className={styles.small}>You can cancel within 15 minutes of sending.</p>
        </div>
      </aside>

      {/* phones: the panel becomes a bar along the bottom */}
      <div className={styles.sendbar}>
        <div className={styles.sbText}>
          <b>{costTitle}</b>
          <span>{costLine}</span>
        </div>
        {sendButton('')}
      </div>

      {sendFlow.dialogs}
    </div>
  )
}

function CardFace({ url, side }: { url: string | null; side: 'front' | 'back' }) {
  const isPdf = !!url && /\.pdf(\?|$)/i.test(url)
  return (
    <div className={styles.card}>
      {url ? (
        isPdf ? (
          <iframe src={`${url}#toolbar=0&view=Fit`} title={`Your card, ${side}`} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- user designs live on storage URLs of any size
          <img src={url} alt={`Your card, ${side}`} />
        )
      ) : (
        <div className={styles.cardEmpty}>
          <span>
            No {side} design yet. <Link href="/postcards/design">Choose one</Link>
          </span>
        </div>
      )}
      {side === 'back' && (
        <div className={styles.addressHalf} aria-hidden="true">
          <i style={{ width: '70%' }} />
          <i style={{ width: '85%' }} />
          <i style={{ width: '60%' }} />
        </div>
      )}
    </div>
  )
}
