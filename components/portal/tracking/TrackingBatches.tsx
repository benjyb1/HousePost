'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import CancelOrderButton from '@/components/postcards/CancelOrderButton'
import { StatusGuide } from '@/components/postcards/StatusGuide'
import { SendAgainButton } from '@/components/postcards/TrackingSend'
import {
  STAGES,
  buildBatches,
  cardCount,
  isPdf,
  matchesFilter,
  matchesQuery,
  type Batch,
  type Filter,
  type Row,
  type Stage,
  type TrackingCard,
} from './model'
import chrome from '@/components/portal/page-chrome.module.css'
import styles from './tracking.module.css'

/*
  Tracking, laid out as batches: one section per day you sent cards, newest
  first. Each batch has a thin bar showing how far its cards have got, and the
  rows underneath show each card's own progress. The two newest batches start
  open; older ones fold away. Must sit inside TrackingSendProvider so "Send
  again" can open the usual review and cool-off.
*/

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'way', label: 'On the way' },
  { key: 'done', label: 'Delivered' },
]

// Delivered first, so the bar fills from the left as cards arrive.
const BAR_ORDER: Stage[] = [3, 2, 1, 0]
const SWATCH = [styles.s0, styles.s1, styles.s2, styles.s3]

const OPEN_BY_DEFAULT = 2

export function TrackingBatches({ cards, now }: { cards: TrackingCard[]; now: string }) {
  // The server's clock for the first render, then the browser's, so "You can
  // cancel until 14:32" stops being offered once 14:32 has passed.
  const [nowMs, setNowMs] = useState(() => Date.parse(now))
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [opened, setOpened] = useState<Record<string, boolean>>({})

  const batches = useMemo(() => buildBatches(cards, nowMs), [cards, nowMs])
  const searching = query.trim().length > 0

  const shown = useMemo(
    () =>
      batches
        .map((batch, index) => ({
          batch,
          index,
          rows: batch.rows.filter((r) => matchesFilter(r, filter) && matchesQuery(r, query)),
        }))
        .filter((b) => b.rows.length > 0),
    [batches, filter, query],
  )
  const shownCount = shown.reduce((n, b) => n + b.rows.length, 0)

  if (cards.length === 0) {
    return (
      <div className={`${chrome.page} ${styles.root}`}>
        <div className={chrome.title}>
          <h1>Tracking</h1>
        </div>
        <p className={styles.empty}>
          Postcards you send from <Link href="/dashboard">Home</Link> will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className={`${chrome.page} ${styles.root}`}>
      <div className={chrome.title}>
        <h1>Tracking</h1>
        <span className={styles.guide}>
          <StatusGuide />
        </span>
      </div>

      <div className={styles.tools}>
        <label htmlFor="tracking-search" className="sr-only">
          Search your cards
        </label>
        <input
          id="tracking-search"
          className={styles.search}
          type="search"
          placeholder="Search address or postcode"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.seg} role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {searching || filter !== 'all' ? `${cardCount(shownCount)} shown` : ''}
      </p>

      {shown.length === 0 ? (
        <p className={styles.none}>{emptyMessage(query, filter)}</p>
      ) : (
        shown.map(({ batch, index, rows }) => (
          <BatchSection
            key={batch.day}
            batch={batch}
            rows={rows}
            searching={searching}
            open={searching || (opened[batch.day] ?? index < OPEN_BY_DEFAULT)}
            onToggle={() =>
              setOpened((prev) => ({ ...prev, [batch.day]: !(prev[batch.day] ?? index < OPEN_BY_DEFAULT) }))
            }
          />
        ))
      )}
    </div>
  )
}

function emptyMessage(query: string, filter: Filter): string {
  if (query.trim()) return `No cards match “${query.trim()}”.`
  if (filter === 'done') return 'None of your cards have been delivered yet.'
  return 'Nothing is on its way right now.'
}

function BatchSection({
  batch,
  rows,
  searching,
  open,
  onToggle,
}: {
  batch: Batch
  rows: Row[]
  searching: boolean
  open: boolean
  onToggle: () => void
}) {
  const total = batch.rows.length
  const headingId = `batch-${batch.day}`
  const rowsId = `batch-${batch.day}-cards`
  const sub = [cardCount(total), batch.cost, rows.length < total ? `showing ${rows.length}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className={styles.batch} aria-labelledby={headingId}>
      <div className={styles.bHead}>
        <div>
          <h2 id={headingId}>{batch.label}</h2>
          <span className={styles.bSub}>{sub}</span>
        </div>
        {!searching && (
          <button type="button" className={chrome.textbtn} aria-expanded={open} aria-controls={rowsId} onClick={onToggle}>
            {open ? 'Hide cards' : 'Show cards'}
          </button>
        )}
        <div className={styles.bBar} aria-hidden="true">
          {BAR_ORDER.map((s) =>
            batch.stageCounts[s] ? (
              <i key={s} className={SWATCH[s]} style={{ width: `${((100 * batch.stageCounts[s]) / total).toFixed(2)}%` }} />
            ) : null,
          )}
        </div>
        <div className={styles.bKey}>
          {BAR_ORDER.map((s) =>
            batch.stageCounts[s] ? (
              <span key={s}>
                <i className={SWATCH[s]} aria-hidden="true" />
                {batch.stageCounts[s]} {STAGES[s].toLowerCase()}
              </span>
            ) : null,
          )}
          {batch.problemCounts.map((p) => (
            <span key={p.label} className={/cancel/i.test(p.label) ? styles.quiet : styles.problem}>
              {p.count} {p.label}
            </span>
          ))}
        </div>
      </div>

      {batch.holds.map((h) => (
        <div key={h.orderId} className={styles.hold}>
          <p>
            <b>{h.title}</b>
            {h.body}
          </p>
          <span className={styles.action}>
            <CancelOrderButton orderId={h.orderId} />
          </span>
        </div>
      ))}

      {batch.notices.map((n) => (
        <p key={n} className={styles.notice}>
          {n}
        </p>
      ))}

      <ul id={rowsId} className={styles.rows} hidden={!open}>
        {rows.map((r) => (
          <CardRow key={r.id} row={r} withThumb={batch.hasThumbs} />
        ))}
      </ul>
    </section>
  )
}

function CardRow({ row, withThumb }: { row: Row; withThumb: boolean }) {
  const { stage, problem, word, note } = row.view
  const className = [styles.row, withThumb ? null : styles.noThumb, row.canSendAgain ? null : styles.noAct]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={className}>
      {withThumb && <Thumb url={row.frontUrl} />}
      <div className={styles.addr}>
        <b>{row.address}</b>
        <span>{row.postcode}</span>
      </div>
      <span className={styles.mini} aria-hidden="true">
        {STAGES.map((s, i) => (
          <i key={s} className={stage !== null && i <= stage ? styles.on : undefined} />
        ))}
      </span>
      <div className={styles.stat}>
        <span className={problem === 'cancelled' ? styles.quiet : problem ? styles.problem : undefined}>{word}</span>
        <small>{note}</small>
      </div>
      <div className={`${styles.act} ${styles.action}`}>
        {row.canSendAgain && <SendAgainButton leadId={row.leadId} inFlight={row.inFlight} />}
      </div>
    </li>
  )
}

/** The card's front, small. A PDF or a link that no longer loads shows a plain card shape. */
function Thumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false)
  const src = url && !broken && !isPdf(url) ? url : null
  return (
    <span className={styles.thumb} aria-hidden="true">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- user design URLs from storage, any host
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      )}
    </span>
  )
}
