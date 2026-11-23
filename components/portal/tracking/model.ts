// Tracking: how a postcard job reads on the page. Pure functions only, so the
// server page, the client list and the dev fixture all agree.
//
// Labels come from components/postcards/status.ts (the same words the "What do
// these mean?" panel uses). This file only adds the four-stage progress view
// and the per-day batches.

import { formatAddressLine, formatPostcode } from '@/lib/address/format'
import { IN_FLIGHT_JOB_STATUSES, statusLabel, trackingStatus } from '@/components/postcards/status'

/** One card as the Tracking page needs it. Plain data, safe to pass to the client. */
export type TrackingCard = {
  id: string
  leadId: string | null
  /** The order (one send) this card belongs to. Cancel works per order. */
  batchId: string | null
  /** Display-formatted address line and postcode. */
  address: string
  postcode: string
  /** The coarse job status (held, dispatched, cancelled…). */
  status: string
  /** trackingStatus(job): the fine status the page shows. */
  key: string
  createdAt: string
  releaseAt: string | null
  /** When the card reached its current status, as near as we know. */
  statusAt: string
  chargePence: number
  /** The front design snapshotted when the card was sent, if any. */
  frontUrl: string | null
}

/** The postcard_jobs columns the page reads. */
export type PostcardJobRow = {
  id: string
  lead_id: string | null
  recipient_address_line: string
  recipient_postcode: string
  charge_amount_pence: number | null
  dispatched_at: string | null
  status: string
  postgrid_status: string | null
  batch_id: string | null
  created_at: string
  updated_at: string | null
  release_at: string | null
  failed_at: string | null
  retry_count?: number | null
  held_design_front_url: string | null
}

/**
 * One job as a card. Each row is one card that went (or is going) out, so an
 * address sent to twice shows twice.
 */
export function fromJob(job: PostcardJobRow): TrackingCard {
  const key = trackingStatus(job)
  return {
    id: job.id,
    leadId: job.lead_id,
    batchId: job.batch_id,
    // Same title-casing as Home, so an address reads the same everywhere.
    address: formatAddressLine(job.recipient_address_line),
    postcode: formatPostcode(job.recipient_postcode),
    status: job.status,
    key,
    createdAt: job.created_at,
    releaseAt: job.release_at ?? null,
    // The poller only writes a row when its status moves, so updated_at is
    // when the card reached the status it shows.
    statusAt: (key === 'failed' ? job.failed_at : null) ?? job.updated_at ?? job.dispatched_at ?? job.created_at,
    chargePence: job.charge_amount_pence ?? 0,
    frontUrl: job.held_design_front_url?.trim() || null,
  }
}

export const STAGES = ['Scheduled', 'Printing', 'Dispatched', 'Delivered'] as const
export type Stage = 0 | 1 | 2 | 3

/** Where each real status sits on the four-step bar. */
export const STAGE_OF: Record<string, Stage> = {
  held: 0,
  pending: 0,
  dispatching: 0,
  received: 1,
  processing: 1,
  production: 1,
  printed: 1,
  provider_hold: 1,
  dispatched: 2,
  local_delivery: 2,
  delivered: 3,
}

/** Statuses that are off the normal journey, with the word the row shows. */
export const PROBLEM_LABELS: Record<string, string> = {
  failed: 'Couldn’t send',
  error: 'Couldn’t send',
  returned: 'Returned',
  refund_failed: statusLabel('refund_failed'),
  cancelled: 'Cancelled',
  delayed: 'Delayed',
}

export type Filter = 'all' | 'way' | 'done'

// ---------------------------------------------------------------------------
// Dates, always in UK time. Month names are spelt out here rather than taken
// from Intl so the server render and the browser can never disagree.

const TZ = 'Europe/London'
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

type UkTime = { y: number; m: number; d: number; hh: number; mm: number; day: string }

const pad = (n: number) => String(n).padStart(2, '0')

function ukTime(at: string | number): UkTime {
  const t = { y: 0, m: 0, d: 0, hh: 0, mm: 0 }
  for (const p of partsFormat.formatToParts(new Date(at))) {
    if (p.type === 'year') t.y = Number(p.value)
    else if (p.type === 'month') t.m = Number(p.value)
    else if (p.type === 'day') t.d = Number(p.value)
    else if (p.type === 'hour') t.hh = Number(p.value) % 24
    else if (p.type === 'minute') t.mm = Number(p.value)
  }
  return { ...t, day: `${t.y}-${pad(t.m)}-${pad(t.d)}` }
}

/** Calendar arithmetic on a YYYY-MM-DD key, so clock changes can't skip a day. */
function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + by))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

type Clock = { now: number; today: string; yesterday: string; tomorrow: string; year: number }

function clockAt(now: number): Clock {
  const t = ukTime(now)
  return { now, today: t.day, yesterday: shiftDay(t.day, -1), tomorrow: shiftDay(t.day, 1), year: t.y }
}

function shortDate(at: string, clock: Clock): string {
  const t = ukTime(at)
  if (t.day === clock.today) return 'Today'
  if (t.day === clock.yesterday) return 'Yesterday'
  return `${t.d} ${MONTHS_SHORT[t.m - 1]}${t.y === clock.year ? '' : ` ${t.y}`}`
}

/** "14:32", "14:32 tomorrow" or "24 Nov, 14:32". */
function timeLabel(at: string, clock: Clock): string {
  const t = ukTime(at)
  const time = `${pad(t.hh)}:${pad(t.mm)}`
  if (t.day === clock.today) return time
  if (t.day === clock.tomorrow) return `${time} tomorrow`
  return `${t.d} ${MONTHS_SHORT[t.m - 1]}, ${time}`
}

function batchLabel(day: string, clock: Clock): string {
  if (day === clock.today) return 'Sent today'
  if (day === clock.yesterday) return 'Sent yesterday'
  const [y, m, d] = day.split('-').map(Number)
  return `Sent ${d} ${MONTHS_LONG[m - 1]}${y === clock.year ? '' : ` ${y}`}`
}

// ---------------------------------------------------------------------------
// One row

export type CardView = {
  /** Step reached on the bar, or null when the card is off the normal journey. */
  stage: Stage | null
  /** Set for failed, returned, cancelled, delayed and refund cases. */
  problem: string | null
  word: string
  note: string
}

export type Row = TrackingCard & {
  view: CardView
  /** Lower-case address and postcode, plus the postcode without spaces. */
  haystack: string
  canSendAgain: boolean
  inFlight: boolean
}

function describe(card: TrackingCard, clock: Clock): CardView {
  const problem = PROBLEM_LABELS[card.key] ? card.key : null
  const stage = problem ? null : (STAGE_OF[card.key] ?? null)
  const word = problem ? PROBLEM_LABELS[card.key] : statusLabel(card.key)

  let note: string
  switch (card.key) {
    case 'held':
      note =
        card.releaseAt && Date.parse(card.releaseAt) > clock.now
          ? `Prints at ${timeLabel(card.releaseAt, clock)}`
          : 'Going to print'
      break
    case 'pending':
      note = 'Confirming payment'
      break
    case 'dispatching':
      note = 'Going to print'
      break
    case 'delayed':
      note = 'Goes out automatically'
      break
    default:
      note = shortDate(card.statusAt, clock)
  }
  return { stage, problem, word, note }
}

function toRow(card: TrackingCard, clock: Clock): Row {
  const inFlight = IN_FLIGHT_JOB_STATUSES.has(card.status)
  return {
    ...card,
    view: describe(card, clock),
    haystack: `${card.address} ${card.postcode} ${card.postcode.replace(/\s+/g, '')}`.toLowerCase(),
    // "Send again" only shows where it can be used: not while this card is
    // still on its way to print, and not once its lead has gone.
    canSendAgain: Boolean(card.leadId) && !inFlight,
    inFlight,
  }
}

export function matchesFilter(row: Row, filter: Filter): boolean {
  const { stage, problem } = row.view
  if (filter === 'done') return stage === 3
  if (filter === 'way') return (stage !== null && stage < 3) || problem === 'delayed'
  return true
}

export function matchesQuery(row: Row, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return row.haystack.includes(q) || row.haystack.includes(q.replace(/\s+/g, ''))
}

// ---------------------------------------------------------------------------
// One day's batch

export type Hold = { orderId: string; title: string; body: string }

export type Batch = {
  day: string
  label: string
  rows: Row[]
  /** Cards at each of the four stages. */
  stageCounts: [number, number, number, number]
  /** Cards off the normal journey, grouped by the word they show. */
  problemCounts: { label: string; count: number }[]
  /** "5 included, £15.00 extra", or null when nothing was paid. */
  cost: string | null
  /** Orders in this batch that can still be cancelled. */
  holds: Hold[]
  /** Plain explanations for cards that need one. */
  notices: string[]
  /** True when at least one card has a picture of its front. */
  hasThumbs: boolean
}

const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`
const money = (pence: number) => `£${(pence / 100).toFixed(2)}`

export function isPdf(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url)
}

function summarise(day: string, rows: Row[], clock: Clock): Batch {
  const stageCounts: [number, number, number, number] = [0, 0, 0, 0]
  const problems = new Map<string, number>()
  for (const r of rows) {
    if (r.view.stage !== null) stageCounts[r.view.stage]++
    else if (r.view.problem) {
      const label = r.view.word.toLowerCase()
      problems.set(label, (problems.get(label) ?? 0) + 1)
    }
  }

  // Cost: cancelled and failed cards are refunded, so they don't count.
  const kept = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'failed')
  const paidPence = kept.reduce((sum, r) => sum + Math.max(0, r.chargePence), 0)
  const included = kept.filter((r) => r.chargePence <= 0).length
  const cost = paidPence > 0 ? (included > 0 ? `${included} included, ${money(paidPence)} extra` : `${money(paidPence)} extra`) : null

  // Cancel is per order, and the endpoint only touches cards still held.
  const byOrder = new Map<string, Row[]>()
  for (const r of rows) {
    if (r.status !== 'held' || !r.batchId) continue
    const list = byOrder.get(r.batchId)
    if (list) list.push(r)
    else byOrder.set(r.batchId, [r])
  }
  const holds: Hold[] = [...byOrder.entries()].map(([orderId, held]) => {
    const n = held.length
    const releases = held.map((r) => (r.releaseAt ? Date.parse(r.releaseAt) : 0))
    const lastRelease = Math.max(...releases)
    const allDelayed = held.every((r) => r.key === 'delayed')
    if (allDelayed) {
      return { orderId, title: `${cards(n)} delayed`, body: `You can still cancel until ${n === 1 ? 'it goes' : 'they go'} to print.` }
    }
    return {
      orderId,
      title: `${cards(n)} scheduled`,
      body:
        lastRelease > clock.now
          ? `You can cancel until ${timeLabel(new Date(lastRelease).toISOString(), clock)}. After that ${n === 1 ? 'it goes' : 'they go'} to print.`
          : `Going to print now. You can still cancel until ${n === 1 ? 'it does' : 'they do'}.`,
    }
  })

  const count = (key: string) => rows.filter((r) => r.key === key).length
  const notices: string[] = []
  const failed = count('failed')
  if (failed) {
    notices.push(
      `${cards(failed)} couldn’t be sent. Any charge was refunded and the lead is back in your list, so you can send ${failed === 1 ? 'it' : 'them'} again.`,
    )
  }
  const error = count('error')
  if (error) notices.push(`${cards(error)} ran into a problem after printing. Our team is looking into it.`)
  const delayed = count('delayed')
  if (delayed) {
    notices.push(
      `${cards(delayed)} ${delayed === 1 ? 'is' : 'are'} held up by a problem on our side. ${delayed === 1 ? 'It goes' : 'They go'} out automatically, with nothing more to pay.`,
    )
  }
  const refund = count('refund_failed')
  if (refund) notices.push(`${cards(refund)} cancelled and waiting on a refund. Our team is sorting it out.`)

  return {
    day,
    label: batchLabel(day, clock),
    rows,
    stageCounts,
    problemCounts: [...problems.entries()].map(([label, n]) => ({ label, count: n })),
    cost,
    holds,
    notices,
    hasThumbs: rows.some((r) => r.frontUrl && !isPdf(r.frontUrl)),
  }
}

/** Group cards by the UK day they were sent, newest day first. */
export function buildBatches(input: TrackingCard[], now: number): Batch[] {
  const clock = clockAt(now)
  const sorted = [...input].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const byDay = new Map<string, Row[]>()
  for (const card of sorted) {
    const day = ukTime(card.createdAt).day
    const list = byDay.get(day)
    if (list) list.push(toRow(card, clock))
    else byDay.set(day, [toRow(card, clock)])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, rows]) => summarise(day, rows, clock))
}

export { cards as cardCount }
