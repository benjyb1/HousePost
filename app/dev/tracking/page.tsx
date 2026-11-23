export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { TrackingSendProvider } from '@/components/postcards/TrackingSend'
import { TrackingBatches } from '@/components/portal/tracking/TrackingBatches'
import { fromJob, type PostcardJobRow } from '@/components/portal/tracking/model'

/*
  Dev only: the Tracking page filled with example cards, so it can be looked at
  and screenshotted without signing in. 404s in production. Nothing here reads
  or writes the database; "Send again" and "Cancel order" will fail politely
  because there is no signed-in user.
*/

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 148 105">${body}</svg>`)}`

// Two stand-in fronts: a navy card with a house, and a pale green one.
const DESIGNS = {
  navy: svg(
    '<rect width="148" height="105" fill="#0f1f3d"/>' +
      '<path d="M18 62 40 42l22 20v26H18z" fill="#fdfcf9"/><rect x="34" y="70" width="12" height="18" fill="#0f1f3d"/>' +
      '<rect x="76" y="32" width="54" height="8" rx="1" fill="#fdfcf9"/>' +
      '<rect x="76" y="46" width="44" height="4" rx="1" fill="#9eaccb"/><rect x="76" y="54" width="48" height="4" rx="1" fill="#9eaccb"/>',
  ),
  sage: svg(
    '<rect width="148" height="105" fill="#eeeae2"/><rect width="68" height="105" fill="#d9e8cb"/>' +
      '<circle cx="34" cy="46" r="17" fill="#9bbf87"/><rect x="18" y="70" width="32" height="5" rx="1" fill="#6f9a5b"/>' +
      '<rect x="80" y="34" width="52" height="8" rx="1" fill="#1c2420"/>' +
      '<rect x="80" y="48" width="40" height="4" rx="1" fill="#535c57"/><rect x="80" y="56" width="44" height="4" rx="1" fill="#535c57"/>',
  ),
}

const STREETS = [
  'BUSBRIDGE LANE', 'CROFT ROAD', 'PEPERHAROW ROAD', 'HARE LANE', 'BRIGHTON ROAD', 'CATTESHALL LANE',
  'CHARTERHOUSE ROAD', 'OCKFORD ROAD', 'STATION ROAD', 'TUESLEY LANE', 'FRITH HILL ROAD', 'NIGHTINGALE ROAD',
  'MEADROW', 'BRIDGE ROAD', 'WESTBROOK ROAD', 'SUMMERS ROAD', 'ELSTEAD ROAD', 'LOWER MANOR ROAD', 'WEY HILL',
  'HAMBLEDON ROAD', 'COMBE LANE', 'FARNCOMBE HILL', 'BINSCOMBE LANE', 'SANDY LANE', 'CHURCH STREET', 'MILL LANE',
]
const TOWNS: [string, string][] = [
  ['GODALMING', 'GU7'], ['GODALMING', 'GU7'], ['FARNCOMBE', 'GU7'], ['MILFORD', 'GU8'], ['BUSBRIDGE', 'GU7'],
]
const LETTERS = 'ABDEFGHJLNPQRSTUWXYZ'

// One entry per day sent. Statuses are in send order within the day.
const PLAN: { daysAgo: number; design: keyof typeof DESIGNS | null; paidFrom: number; statuses: string[] }[] = [
  // Today: still in the 15-minute cool-off. Four included, two paid.
  { daysAgo: 0, design: 'navy', paidFrom: 4, statuses: ['held', 'held', 'held', 'held', 'held', 'held'] },
  // Yesterday: at the printer, one failed, one delayed by a print problem.
  {
    daysAgo: 1,
    design: 'sage',
    paidFrom: 99,
    statuses: ['received', 'processing', 'processing', 'production', 'production', 'printed', 'failed', 'delayed'],
  },
  {
    daysAgo: 3,
    design: 'navy',
    paidFrom: 5,
    statuses: ['dispatched', 'dispatched', 'dispatched', 'local_delivery', 'delivered', 'delivered', 'delivered'],
  },
  {
    daysAgo: 5,
    design: 'navy',
    paidFrom: 99,
    statuses: ['delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'dispatched', 'returned'],
  },
  { daysAgo: 9, design: 'sage', paidFrom: 5, statuses: ['delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'cancelled'] },
  // Older cards, sent before designs were kept with each card: no thumbnails.
  { daysAgo: 14, design: null, paidFrom: 99, statuses: ['delivered', 'delivered', 'delivered', 'delivered', 'delivered'] },
]

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function buildJobs(now: number): PostcardJobRow[] {
  const rand = seeded(7)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const iso = (t: number) => new Date(Math.min(t, now - MIN)).toISOString()
  const jobs: PostcardJobRow[] = []
  let n = 0

  for (const day of PLAN) {
    const sentAt = day.daysAgo === 0 ? now - 3 * MIN : now - day.daysAgo * DAY - 2 * HOUR
    const order = `order-${day.daysAgo}`
    day.statuses.forEach((s, i) => {
      n++
      const [town, district] = pick(TOWNS)
      const created = sentAt + i * 1000
      const held = s === 'held' || s === 'delayed'
      const dispatched = !held && s !== 'failed' && s !== 'cancelled'
      const after = {
        received: 2 * HOUR, processing: 3 * HOUR, production: 5 * HOUR, printed: 8 * HOUR,
        dispatched: DAY, local_delivery: 2 * DAY, delivered: 3 * DAY, returned: 6 * DAY,
        failed: 20 * MIN, cancelled: 6 * MIN,
      }[s] ?? 0
      jobs.push({
        id: `card-${n}`,
        // One card whose lead has since been deleted, so it can't be sent again.
        lead_id: day.daysAgo === 14 && i === 4 ? null : `lead-${n}`,
        recipient_address_line: `${1 + Math.floor(rand() * 60)}, ${pick(STREETS)}, ${town}`,
        recipient_postcode: `${district} ${1 + Math.floor(rand() * 9)}${pick([...LETTERS])}${pick([...LETTERS])}`,
        charge_amount_pence: i >= day.paidFrom ? 150 : 0,
        dispatched_at: dispatched ? iso(created + 16 * MIN) : null,
        status: held ? 'held' : dispatched ? 'dispatched' : s,
        postgrid_status: dispatched ? s : null,
        batch_id: order,
        created_at: new Date(created).toISOString(),
        updated_at: iso(created + after),
        // One release time per order, as a real send has.
        release_at: s === 'held' ? new Date(sentAt + 15 * MIN).toISOString() : s === 'delayed' ? new Date(now + 25 * MIN).toISOString() : null,
        failed_at: s === 'failed' ? iso(created + after) : null,
        retry_count: s === 'delayed' ? 2 : 0,
        held_design_front_url: day.design ? DESIGNS[day.design] : null,
      })
    })
  }
  return jobs
}

function requestTime(): number {
  return Date.now()
}

export default function DevTrackingPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const now = requestTime()
  const cards = buildJobs(now).map(fromJob)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-paper)', color: 'var(--color-ink)' }}>
      <TrackingSendProvider hasBackDesign>
        <TrackingBatches cards={cards} now={new Date(now).toISOString()} />
      </TrackingSendProvider>
    </div>
  )
}
