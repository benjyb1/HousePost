// How each postcard status looks and reads on Tracking. The table and the
// "What do these mean?" panel both use this, so a label or colour can never
// differ between them. No print supplier or carrier is ever named.

import { POSTCARD_COOL_OFF_MINUTES } from '@/types/profile'

export const STATUS_LABELS: Record<string, string> = {
  held: 'Scheduled',
  dispatching: 'Sending',
  pending: 'Pending',
  received: 'Received',
  processing: 'Processing',
  production: 'Printing',
  printed: 'Printed',
  dispatched: 'Dispatched',
  local_delivery: 'At delivery office',
  delivered: 'Delivered',
  delayed: 'Delayed',
  provider_hold: 'On hold',
  returned: 'Returned',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refund_failed: 'Refund pending',
  error: 'Error',
}

export const STATUS_COLOURS: Record<string, string> = {
  held: 'bg-purple-100 text-purple-800',
  dispatching: 'bg-blue-100 text-blue-800',
  pending: 'bg-slate-100 text-slate-600',
  received: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-yellow-100 text-yellow-800',
  production: 'bg-orange-100 text-orange-800',
  printed: 'bg-orange-100 text-orange-800',
  dispatched: 'bg-blue-100 text-blue-800',
  local_delivery: 'bg-teal-100 text-teal-800',
  delivered: 'bg-green-100 text-green-800',
  delayed: 'bg-amber-100 text-amber-800',
  provider_hold: 'bg-purple-100 text-purple-800',
  returned: 'bg-rose-100 text-rose-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-400',
  refund_failed: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
}

// Coarse job states where a card is still on its way to print. "Send again"
// waits until these are over, or it would print a second card.
export const IN_FLIGHT_JOB_STATUSES = new Set(['pending', 'held', 'dispatching'])

/**
 * The status key a Tracking row shows. The fine-grained printer state lives in
 * postgrid_status once a card has been handed over; before that the job's own
 * status applies. A held card that has already been retried is "Delayed".
 */
export function trackingStatus(job: {
  status: string
  postgrid_status: string | null
  retry_count?: number | null
}): string {
  const raw = job.postgrid_status ?? job.status
  return raw === 'held' && (job.retry_count ?? 0) > 0 ? 'delayed' : raw
}

export function statusLabel(key: string): string {
  return STATUS_LABELS[key] ?? key.replace(/_/g, ' ')
}

export function statusColour(key: string): string {
  return STATUS_COLOURS[key] ?? 'bg-slate-100 text-slate-600'
}

export type StatusGuideEntry = { key: string; meaning: string; reasons?: string[] }

/** The normal journey, in the order a card moves through it. */
export const JOURNEY: StatusGuideEntry[] = [
  { key: 'held', meaning: `Waiting out the ${POSTCARD_COOL_OFF_MINUTES}-minute cool-off. You can still cancel for a full refund.` },
  { key: 'dispatching', meaning: 'Being handed over for printing. This takes a moment.' },
  { key: 'received', meaning: 'Accepted for printing.' },
  { key: 'processing', meaning: 'Being prepared for print.' },
  { key: 'production', meaning: 'On the press.' },
  { key: 'printed', meaning: 'Printed and waiting to be posted.' },
  { key: 'dispatched', meaning: 'In the post. Most cards arrive within 2 to 3 working days.' },
  { key: 'local_delivery', meaning: 'At the local delivery office, ready to go out.' },
  { key: 'delivered', meaning: 'Delivered, going by standard postal delivery times. The post doesn’t scan every card at the door.' },
]

/** Everything else a card can show. */
export const EXCEPTIONS: StatusGuideEntry[] = [
  { key: 'delayed', meaning: 'A temporary problem on our side. It’s still queued and goes out automatically once it clears, with nothing extra to pay.' },
  {
    key: 'failed',
    meaning: 'Not sent. Any charge is refunded and the lead goes back into your list. The usual reasons:',
    reasons: [
      'The address couldn’t be used for posting. Check it, then send again.',
      'Your design couldn’t be printed. Check both sides in Postcard Design, then send again.',
      'A printing problem on our side didn’t clear after several tries. Send it again.',
    ],
  },
  { key: 'returned', meaning: 'The post couldn’t deliver it, usually because the address is incomplete or no longer in use.' },
  { key: 'cancelled', meaning: 'Cancelled before it went to print. Any charge was refunded.' },
  { key: 'provider_hold', meaning: 'Held for a check at the printer. It usually moves on by itself.' },
  { key: 'refund_failed', meaning: 'Cancelled, and our team is sorting out the refund.' },
  { key: 'pending', meaning: 'We’re confirming your payment. If it doesn’t clear soon, our team will sort it out.' },
  { key: 'error', meaning: 'Something went wrong after printing. Our team is looking into it.' },
]
