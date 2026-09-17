import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculatePostcardCost,
  chargePostcardBatch,
  refundPostcardCharge,
} from '@/lib/stripe/billing'
import { sendPostcard, buildRecipient } from '@/lib/postcards/stannp'
import { sendAdminAlert } from '@/lib/email/resend'
import { currentMonthKey } from '@/lib/utils/date'
import { loadSuppressionKeys, isSuppressed } from '@/lib/leads/suppression'
import { POSTCARD_OVERAGE_PENCE, MONTHLY_POSTCARD_CAP } from '@/types/profile'
import { resolveBackUrl } from '@/lib/postcards/defaults'
import { checkPrintCapacity } from '@/lib/postcards/stannp-account'
import { classifyDispatchError } from '@/lib/postcards/failure'

// Only a card that has actually been posted may be re-sent. Anything else
// (in-flight OR dead) is refused: resending a pending/held/dispatching card
// would print a second one, and resending a failed/cancelled card whose lead has
// since been freed back to New leads could be sent twice via two paths.
const RESENDABLE_SOURCE_STATUSES = ['dispatched', 'delivered']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await request.json() as { jobId: string }
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  // Fetch the original job
  const { data: job, error: jobError } = await supabase
    .from('postcard_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Enforce the allow-list at the API, not just in the UI. A failed/cancelled or
  // still-in-flight source is refused so a card can never be sent twice.
  if (!RESENDABLE_SOURCE_STATUSES.includes(job.status as string)) {
    return NextResponse.json(
      { error: 'Only a postcard that has already been sent can be re-sent.' },
      { status: 409 }
    )
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, postcards_used_this_period, postcard_design_url, postcard_design_back_url, full_name, subscription_status')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!['active', 'trialing'].includes(profile.subscription_status as string)) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
  }

  const frontUrl = profile.postcard_design_url as string | null
  // No back design → the blank default back (see lib/postcards/defaults.ts).
  const backUrl = resolveBackUrl(profile.postcard_design_back_url as string | null)
  if (!frontUrl) {
    return NextResponse.json(
      { error: 'Add a postcard design before re-sending.' },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()

  // Pre-flight: refuse politely if the prepaid print balance positively cannot
  // cover one more card. Nothing has been reserved or charged yet.
  const capacity = await checkPrintCapacity(1)
  if (!capacity.ok) {
    console.error(`Resend refused: print balance ${capacity.balancePence}p below ${capacity.neededPence}p`)
    return NextResponse.json(
      {
        error:
          'We cannot take new postcard orders right now because of a problem on our side. Nothing has been charged. Please try again in a few hours.',
        serviceUnavailable: true,
      },
      { status: 503 }
    )
  }

  // Do-not-contact screening: if the recipient opted out AFTER the first card
  // went out, refuse the resend. Fails CLOSED (503 on a transient read error).
  try {
    const suppressionKeys = await loadSuppressionKeys(adminSupabase)
    if (
      isSuppressed(suppressionKeys, job.recipient_address_line as string, job.recipient_postcode as string)
    ) {
      return NextResponse.json(
        { error: 'This address is now on our do-not-contact list and can’t be posted to.' },
        { status: 409 }
      )
    }
  } catch (err) {
    console.error('Suppression screen failed for resend:', err)
    return NextResponse.json(
      { error: 'We could not verify the do-not-contact list just now. Please try again shortly.' },
      { status: 503 }
    )
  }

  // Deterministic idempotency key for this (user, job, month). Stannp has no
  // idempotency-key header, so we claim the send at OUR layer first: insert a
  // pending row carrying this key, which is protected by a UNIQUE partial index.
  // A concurrent double-click loses the insert race and never reaches Stannp, so
  // it can't print a second card.
  const idempotencyKey = createHash('sha256')
    .update(`resend:${user.id}:${jobId}:${currentMonthKey()}`)
    .digest('hex')
    .slice(0, 40)

  const { data: pending, error: insertErr } = await adminSupabase.from('postcard_jobs').insert({
    user_id: user.id,
    lead_id: job.lead_id,
    lead_month: job.lead_month,
    recipient_address_line: job.recipient_address_line,
    recipient_postcode: job.recipient_postcode,
    was_included_in_subscription: true,
    charge_amount_pence: 0,
    status: 'pending',
    dispatch_idempotency_key: idempotencyKey,
  }).select('id').single()

  if (insertErr || !pending) {
    // Unique-key violation (23505) means an identical resend already claimed this
    // slot — treat it as a dedupe rather than billing or printing twice.
    if (insertErr?.code === '23505') {
      return NextResponse.json({ success: true, deduped: true })
    }
    return NextResponse.json({ error: insertErr?.message ?? 'Could not create postcard job' }, { status: 500 })
  }
  const newJobId = pending.id as string

  // Unwind helper: hand back the reserved allowance (optional), mark the row and
  // — crucially — NULL the idempotency key so the card becomes eligible to retry.
  // Leaving the key set on a failed row is what previously wedged resend: the
  // unique index made every later attempt that month dedupe to a silent no-op.
  const unwind = async (
    status: 'failed' | 'cancelled',
    { giveBackAllowance }: { giveBackAllowance: boolean }
  ) => {
    if (giveBackAllowance) {
      await adminSupabase.rpc('decrement_postcards_used', { p_user_id: user.id, p_amount: 1 })
    }
    await adminSupabase
      .from('postcard_jobs')
      .update({ status, dispatch_idempotency_key: null })
      .eq('id', newJobId)
  }

  // Reserve one postcard against the hard monthly cap BEFORE we charge or
  // dispatch. The capped RPC atomically increments the period counter and returns
  // the PRE-increment usage, or -1 if the send would breach the cap.
  const { data: preUsedRaw, error: reserveErr } = await adminSupabase.rpc(
    'increment_postcards_used_capped',
    { p_user_id: user.id, p_amount: 1, p_cap: MONTHLY_POSTCARD_CAP }
  )
  if (reserveErr) {
    await unwind('failed', { giveBackAllowance: false })
    return NextResponse.json(
      { error: 'Could not reserve your postcard allowance. Please try again.' },
      { status: 500 }
    )
  }
  const preUsed = preUsedRaw as number
  if (preUsed < 0) {
    await unwind('cancelled', { giveBackAllowance: false })
    return NextResponse.json(
      { error: `This would exceed your monthly limit of ${MONTHLY_POSTCARD_CAP} postcards.` },
      { status: 403 }
    )
  }
  // Authoritative included/paid split from the reserved pre-usage value.
  const reservedIncluded = calculatePostcardCost(1, preUsed).included > 0

  // Charge the overage UP FRONT (matching the main send flow), not via the old
  // deferred meter. A paid resend that isn't charged here would be a free card.
  let paymentIntentId: string | null = null
  if (!reservedIncluded) {
    try {
      const { paymentIntentId: pi } = await chargePostcardBatch({
        customerId: (profile.stripe_customer_id as string) ?? '',
        amountPence: POSTCARD_OVERAGE_PENCE,
        idempotencyKey: `postcard-resend:${newJobId}`,
        metadata: { userId: user.id, resendOf: jobId, kind: 'postcard_resend' },
      })
      paymentIntentId = pi
    } catch (err) {
      const e = err as Error & { type?: string; code?: string }
      const isDecline =
        e.type === 'StripeCardError' ||
        e.code === 'card_declined' ||
        e.code === 'authentication_required' ||
        e.code === 'no_payment_method'

      if (isDecline) {
        // No money moved — hand the allowance back and refuse cleanly.
        await unwind('cancelled', { giveBackAllowance: true })
        return NextResponse.json(
          { error: e.message || 'Your card was declined.' },
          { status: 402 }
        )
      }

      // Ambiguous: the charge MAY have succeeded. Do NOT dispatch, do NOT give the
      // allowance back, and deliberately KEEP the idempotency key so an automatic
      // retry dedupes instead of risking a second charge. Mark failed, alert, 500.
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Resend charge failed (non-decline) for job ${newJobId}, user ${user.id}:`, msg)
      await adminSupabase.from('postcard_jobs').update({ status: 'failed' }).eq('id', newJobId)
      try {
        await sendAdminAlert(
          `[Housepost] Postcard resend charge failed and needs review — job ${newJobId}`,
          `<p>A £${(POSTCARD_OVERAGE_PENCE / 100).toFixed(2)} resend charge for user
            <strong>${user.id}</strong> failed with a NON-decline error. The charge may have
            succeeded, so the card was NOT posted and the allowance was left counted. Please
            reconcile against Stripe.</p><pre>${msg}</pre>`
        )
      } catch (alertErr) {
        console.error(`Failed to send resend charge-ambiguous alert for job ${newJobId}:`, alertErr)
      }
      return NextResponse.json(
        {
          error:
            'Something went wrong while taking payment. Our team has been notified — please check with support before trying again.',
        },
        { status: 500 }
      )
    }
  }

  // We own the slot, the allowance and (if paid) the charge — print and post.
  let postcardId = ''
  let status = ''
  try {
    const recipient = buildRecipient(
      job.recipient_address_line as string,
      job.recipient_postcode as string,
    )
    ;({ id: postcardId, status } = await sendPostcard({
      to: recipient,
      frontUrl,
      backUrl,
      tag: idempotencyKey,
    }))
  } catch (err) {
    // Dispatch failed: the card was NOT posted, so refund any up-front charge,
    // hand the allowance back and release the row (key nulled) so it can retry.
    if (paymentIntentId) {
      try {
        await refundPostcardCharge({
          paymentIntentId,
          amountPence: POSTCARD_OVERAGE_PENCE,
          idempotencyKey: `postcard-resend-refund:${newJobId}`,
        })
      } catch (refundErr) {
        const rmsg = refundErr instanceof Error ? refundErr.message : String(refundErr)
        console.error(`Resend refund failed for job ${newJobId}:`, rmsg)
        try {
          await sendAdminAlert(
            `[Housepost] Postcard resend failed AND refund failed — job ${newJobId}`,
            `<p>Resend job <strong>${newJobId}</strong> failed to post and the automatic refund of
              ${POSTCARD_OVERAGE_PENCE}p against PaymentIntent <strong>${paymentIntentId}</strong>
              also failed. Please refund manually in Stripe.</p><pre>${rmsg}</pre>`
          )
        } catch (alertErr) {
          console.error(`Failed to alert on resend refund failure for job ${newJobId}:`, alertErr)
        }
      }
    }
    await unwind('failed', { giveBackAllowance: true })
    // Store why, in both the raw and customer-facing forms, and return only the
    // customer-facing one: the supplier's name and API text never reach the UI.
    const raw = err instanceof Error ? err.message : 'Dispatch failed'
    const outcome = classifyDispatchError(raw)
    console.error(`Resend dispatch failed for job ${newJobId}:`, raw)
    await adminSupabase
      .from('postcard_jobs')
      .update({
        failed_at: new Date().toISOString(),
        failure_category: outcome.category,
        failure_reason: outcome.failedMessage,
        last_error: raw,
        last_error_at: new Date().toISOString(),
      })
      .eq('id', newJobId)
    return NextResponse.json({ error: outcome.failedMessage }, { status: 502 })
  }

  // Card is away — record the Stannp id/status, the real charge and the PI so a
  // future refund path can find it.
  await adminSupabase.from('postcard_jobs').update({
    postgrid_letter_id: postcardId,
    postgrid_status: status,
    was_included_in_subscription: reservedIncluded,
    charge_amount_pence: reservedIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
    stripe_payment_intent_id: paymentIntentId,
    status: 'dispatched',
    dispatched_at: new Date().toISOString(),
  }).eq('id', newJobId)

  // Usage was counted by the capped reservation, and any overage was charged
  // up front, so there is nothing to bill or increment here.
  return NextResponse.json({
    success: true,
    charged: reservedIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
  })
}
