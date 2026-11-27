import { createHash } from 'crypto'

/**
 * Stripe idempotency key for refunding the paid cards cancelled in one go.
 *
 * Keyed on the cancelled job ids, not just the order: an order can be
 * cancelled in two parts (a card the cron had already claimed, then the rest),
 * and a key per order made Stripe hand back the first refund for the second
 * cancel, so nothing was refunded. A cancel claims each job exactly once, so
 * the same ids only come round again on a genuine retry of the same refund.
 */
export function cancelRefundKey(orderId: string, paidJobIds: string[]): string {
  const ids = [...new Set(paidJobIds)].sort().join(',')
  const digest = createHash('sha256').update(ids).digest('hex').slice(0, 32)
  return `postcard-refund:${orderId}:${digest}`
}
