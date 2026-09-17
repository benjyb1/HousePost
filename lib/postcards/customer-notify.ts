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
