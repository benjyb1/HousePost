import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refundPostcardCharge } from '@/lib/stripe/billing'
import { POSTCARD_OVERAGE_PENCE } from '@/types/profile'

/**
 * POST /api/postcards/cancel — cancel a held order inside its cool-off window
 * (feature 6.4).
 *
 * Request:  { orderId: string }   // the batch id returned by POST /api/postcards
 *           (alias: { batchId })
 * Response: { success: true, cancelled: number, refundedPence: number, refundFormatted }
 *
 * Only orders that are still 'held' AND still before their release_at can be
 * cancelled; once the release cron has begun dispatching (status 'dispatching'
 * or 'dispatched') or the window has passed, cancellation is refused with 409.
 * Cancelling unwinds everything the send set up: the held rows are marked
 * cancelled, the reserved usage is handed back, the leads are freed for reuse,
 * and the up-front card charge is refunded (only for the paid cards actually
 * cancelled).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const orderId = (body.orderId ?? body.batchId) as string | undefined
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()
  const nowIso = new Date().toISOString()

  // Atomically claim the still-cancellable rows of this order. The
  //   status = 'held' AND release_at > now()
  // predicate is what makes this race-safe against the release cron: the cron
  // only ever transitions 'held' rows whose release_at <= now(), so a given row
  // can be taken by exactly one of the two. The user_id filter ensures a user
  // can only cancel their own order. RETURNING gives us what we need to unwind.
  const { data: cancelledRows, error: cancelErr } = await adminSupabase
    .from('postcard_jobs')
    .update({ status: 'cancelled' })
    .eq('batch_id', orderId)
    .eq('user_id', user.id)
    .eq('status', 'held')
    .gt('release_at', nowIso)
    .select('id, lead_id, was_included_in_subscription, stripe_payment_intent_id')

  if (cancelErr) {
    return NextResponse.json({ error: cancelErr.message }, { status: 500 })
  }

  if (!cancelledRows || cancelledRows.length === 0) {
    // Nothing cancellable — already sent, already cancelled, past the window, or
    // not this user's order.
    return NextResponse.json(
      { error: 'This order can no longer be cancelled — it may already have been sent.' },
      { status: 409 }
    )
  }

  const cancelledCount = cancelledRows.length

  // 1. Free the leads so they can be selected and sent again.
  const leadIds = cancelledRows.map((r) => r.lead_id).filter(Boolean) as string[]
  if (leadIds.length > 0) {
    await adminSupabase
      .from('leads')
      .update({ postcard_job_id: null, selected_for_dispatch: false })
      .in('id', leadIds)
  }

  // 2. Hand back the reserved usage. Guarded/clamped at the DB level, and safe
  //    against a double-click because the atomic claim above only ever returns
  //    each row once.
  await adminSupabase.rpc('decrement_postcards_used', {
    p_user_id: user.id,
    p_amount: cancelledCount,
  })

  // 3. Refund the up-front charge for the PAID cards we just cancelled. Every
  //    paid card in a batch shares one PaymentIntent, so we refund the sum of
  //    the cancelled paid cards against it. The batch-scoped idempotency key
  //    makes a retried cancel return the same refund instead of issuing another.
  const paymentIntentId = cancelledRows.find(
    (r) => r.stripe_payment_intent_id
  )?.stripe_payment_intent_id as string | undefined
  const paidCancelled = cancelledRows.filter((r) => r.was_included_in_subscription === false).length
  const refundPence = paidCancelled * POSTCARD_OVERAGE_PENCE

  let refundedPence = 0
  if (refundPence > 0 && paymentIntentId) {
    try {
      await refundPostcardCharge({
        paymentIntentId,
        amountPence: refundPence,
        idempotencyKey: `postcard-refund:${orderId}`,
      })
      refundedPence = refundPence
    } catch (err) {
      // The cards are already cancelled and will NOT be sent; surface the refund
      // failure so it can be retried/reconciled rather than silently swallowed.
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Refund failed for cancelled order ${orderId}:`, msg)
      return NextResponse.json(
        {
          success: true,
          cancelled: cancelledCount,
          refundedPence: 0,
          refundFormatted: '£0.00',
          warning: 'Your order was cancelled but the refund could not be completed automatically. Our team has been notified.',
        },
        { status: 200 }
      )
    }
  }

  return NextResponse.json({
    success: true,
    cancelled: cancelledCount,
    refundedPence,
    refundFormatted: `£${(refundedPence / 100).toFixed(2)}`,
  })
}
