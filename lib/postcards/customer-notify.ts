// Customer-facing notifications for postcard delays and failures. One
// notification (and, per the user's preference, one email) per user per
// batch, never one per card: a 40-card order hitting an empty print balance
// must not send 40 emails.

import { createNotification } from '@/lib/notifications'

export interface AffectedCard {
  userId: string
  batchId: string | null
  jobId: string
  addressLine: string
  message: string
}

function groupByUserAndBatch(cards: AffectedCard[]): Map<string, AffectedCard[]> {
  const groups = new Map<string, AffectedCard[]>()
  for (const c of cards) {
    const key = `${c.userId}:${c.batchId ?? c.jobId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return groups
}

function plural(n: number): string {
  return n === 1 ? 'postcard' : 'postcards'
}

/** Cards are still queued and will retry on their own. Sent once per batch. */
export async function notifyCustomersDelayed(cards: AffectedCard[]): Promise<void> {
  for (const group of groupByUserAndBatch(cards).values()) {
    const first = group[0]
    const n = group.length
    await createNotification({
      userId: first.userId,
      type: 'postcard_delayed',
      title: `${n} ${plural(n)} delayed`,
      body: `${first.message} Nothing you need to do.`,
      href: '/postcards',
    })
  }
}

/** Cards were failed and unwound. Sent once per batch, with the reasons. */
export async function notifyCustomersFailed(cards: AffectedCard[]): Promise<void> {
  for (const group of groupByUserAndBatch(cards).values()) {
    const first = group[0]
    const n = group.length
    const distinct = [...new Set(group.map((c) => c.message))]
    const body =
      distinct.length === 1
        ? distinct[0]
        : distinct.map((m) => `• ${m}`).join('\n')
    await createNotification({
      userId: first.userId,
      type: 'postcard_failed',
      title: `${n} ${plural(n)} could not be sent`,
      body,
      href: '/postcards',
    })
  }
}

/** A postcard's printer status moved on to one the customer hears about. */
export interface StatusChange {
  userId: string
  status: NotifiableStatus
}

export type NotifiableStatus = 'dispatched' | 'delivered' | 'returned'

// Which status changes become notifications, and which of those also email
// (fix list 7.2). Posted and delivered are good news the customer can read in
// the portal; a returned card needs their attention, so it emails too. Printing
// and "at delivery office" show on Tracking but don't notify.
const STATUS_NOTICES: Record<
  NotifiableStatus,
  { type: string; title: (n: number) => string; body: (n: number) => string; email: boolean }
> = {
  dispatched: {
    type: 'postcard_dispatched',
    title: (n) => `${n} ${plural(n)} dispatched`,
    body: () => 'In the post now. Most arrive within 2 to 3 working days.',
    email: false,
  },
  delivered: {
    type: 'postcard_delivered',
    title: (n) => `${n} ${plural(n)} delivered`,
    body: () => 'Delivered, going by standard postal delivery times.',
    email: false,
  },
  returned: {
    type: 'postcard_returned',
    title: (n) => `${n} ${plural(n)} returned`,
    body: (n) =>
      `The post couldn’t deliver ${n === 1 ? 'it' : 'them'}, usually because the address is incomplete or no longer in use. See which in Tracking.`,
    email: true,
  },
}

/**
 * One notification per user per status per run ("12 postcards delivered"),
 * never one per card. A batch posted together moves through the printer's
 * statuses together, so a run normally sees the whole batch at once.
 */
export async function notifyStatusChanges(changes: StatusChange[]): Promise<void> {
  const counts = new Map<string, { userId: string; status: NotifiableStatus; n: number }>()
  for (const c of changes) {
    const key = `${c.userId}:${c.status}`
    const entry = counts.get(key) ?? { userId: c.userId, status: c.status, n: 0 }
    entry.n++
    counts.set(key, entry)
  }
  for (const { userId, status, n } of counts.values()) {
    const notice = STATUS_NOTICES[status]
    await createNotification({
      userId,
      type: notice.type,
      title: notice.title(n),
      body: notice.body(n),
      href: '/postcards',
      sendEmail: notice.email,
    })
  }
}

export function isNotifiableStatus(status: string): status is NotifiableStatus {
  return status in STATUS_NOTICES
}
