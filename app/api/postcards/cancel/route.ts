import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refundPostcardCharge } from '@/lib/stripe/billing'
import { sendAdminAlert } from '@/lib/email/resend'
import { POSTCARD_OVERAGE_PENCE } from '@/types/profile'

/**
 * POST /api/postcards/cancel — cancel a held order inside its cool-off window
 * (feature 6.4).
 *
 * Request:  { orderId: string }   // the batch id returned by POST /api/postcards
 *           (alias: { batchId })
 * Response: { success: true, cancelled: number, refundedPence: number, refundFormatted }
 *
 * Only orders that are still 'held' can be cancelled; once the release cron has
 * begun dispatching (status 'dispatching' or 'dispatched') cancellation is
 * refused with 409. We do NOT gate on release_at: the cron atomically flips a
 * row 'held' -> 'dispatching' before it calls Stannp, so the 'held' claim alone
 * is race-safe (each row is taken by exactly one of cancel or the cron) and lets
 * a user cancel right up to the moment of dispatch even if the cron runs late.
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

  // Atomically claim the still-cancellable rows of this order. The
  //   status = 'held'
  // predicate is what makes this race-safe against the release cron: the cron
  // flips a row 'held' -> 'dispatching' before it sends, so a given row can be
  // taken by exactly one of cancel or the cron. The user_id filter ensures a user
  // can only cancel their own order. RETURNING gives us what we need to unwind.
  const { data: cancelledRows, error: cancelErr } = await adminSupabase
    .from('postcard_jobs')
    .update({ status: 'cancelled' })
    .eq('batch_id', orderId)
    .eq('user_id', user.id)
    .eq('status', 'held')
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

  // 1. Free the leads so they can be selected and sent again. A lead that was
  //    being RE-sent goes back to its previous finished job (so it stays in
  //    "Send again" with its history intact) rather than being orphaned.
  for (const r of cancelledRows) {
    if (!r.lead_id) continue
    await adminSupabase.rpc('relink_lead_after_unwind', {
      p_lead_id: r.lead_id as string,
      p_job_id: r.id as string,
    })
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
      // The cards are already cancelled and will NOT be sent, but the refund did
      // not go through. This must NOT be silently lost: (1) alert an operator with
      // the batch + PaymentIntent so it can be refunded by hand, and (2) persist a
      // recoverable marker on the affected rows (postgrid_status = 'refund_failed')
      // so a reconciliation sweep can find exactly which cancelled paid cards are
      // still owed a refund. Then return an honest message.
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `Refund failed for cancelled order ${orderId} (PaymentIntent ${paymentIntentId}):`,
        msg
      )

      const paidRowIds = cancelledRows
        .filter((r) => r.was_included_in_subscription === false)
        .map((r) => r.id as string)
      if (paidRowIds.length > 0) {
        await adminSupabase
          .from('postcard_jobs')
          .update({ postgrid_status: 'refund_failed' })
          .in('id', paidRowIds)
      }

      try {
        await sendAdminAlert(
          `[Housepost] Postcard cancel refund FAILED — order ${orderId}`,
          `<p>A cancelled postcard order could not be refunded automatically and needs a manual
            refund in Stripe.</p>
           <ul>
             <li>Batch id: <strong>${orderId}</strong></li>
             <li>PaymentIntent: <strong>${paymentIntentId}</strong></li>
             <li>Amount owed: <strong>£${(refundPence / 100).toFixed(2)}</strong> (${paidCancelled} paid card${paidCancelled === 1 ? '' : 's'})</li>
             <li>User: <strong>${user.id}</strong></li>
           </ul>
           <p>Affected job rows are marked <code>postgrid_status = 'refund_failed'</code>.</p>
           <pre>${msg}</pre>`
        )
      } catch (alertErr) {
        console.error(`Failed to send refund-failure alert for order ${orderId}:`, alertErr)
      }

      return NextResponse.json(
        {
          success: true,
          cancelled: cancelledCount,
          refundedPence: 0,
          refundFormatted: '£0.00',
          warning:
            'Your order was cancelled but the refund could not be completed automatically. Our team has been notified and will refund you manually.',
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
