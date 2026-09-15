import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, chargePostcardBatch } from '@/lib/stripe/billing'
import { currentMonthKey } from '@/lib/utils/date'
import { createNotification } from '@/lib/notifications'
import {
  INCLUDED_POSTCARDS_PER_MONTH,
  POSTCARD_OVERAGE_PENCE,
  MONTHLY_POSTCARD_CAP,
  POSTCARD_COOL_OFF_MINUTES,
} from '@/types/profile'

// GET: list postcard jobs for the authenticated user
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? currentMonthKey()

  const { data, error } = await supabase
    .from('postcard_jobs')
    .select('*')
    .eq('user_id', user.id)
    .eq('lead_month', month)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data })
}

// Format pence as a UK-style price string, e.g. 150 -> "£1.50".
function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/**
 * POST: two actions.
 *
 *   action: 'preview'  — cost preview only. NOTHING is charged or dispatched.
 *   action: 'confirm'  — (the default) charge the saved card up front for any
 *                        payable cards, then create HELD orders that a cron
 *                        posts after a 15-minute cool-off (feature 6.4).
 *
 * ── Preview request  ────────────────────────────────────────────────────────
 *   { action: 'preview', leadIds: string[] }
 * ── Preview response  ───────────────────────────────────────────────────────
 *   {
 *     preview: true,
 *     requested,          // leadIds.length
 *     quantity,           // eligible cards (already-sent leads excluded)
 *     alreadySent,        // requested - quantity
 *     used,               // postcards_used_this_period
 *     includedRemaining,  // max(0, 5 - used)
 *     includedApplied,    // min(quantity, includedRemaining)
 *     payable,            // max(0, quantity - includedRemaining)
 *     unitPricePence: 150,
 *     costPence,          // payable * 150
 *     costFormatted,      // "£X.XX"
 *     cap: 50,
 *     capRemaining,       // max(0, 50 - used)
 *     wouldExceedCap,     // used + quantity > 50
 *     designsReady,       // both postcard designs uploaded?
 *   }
 *
 * ── Confirm request  ────────────────────────────────────────────────────────
 *   { action: 'confirm', leadIds: string[] }   // action omitted == confirm
 * ── Confirm response (201)  ─────────────────────────────────────────────────
 *   {
 *     success: true,
 *     orderId,            // batch id — pass to POST /api/postcards/cancel
 *     jobIds: string[],
 *     quantity,           // cards held
 *     included,           // free cards in this order
 *     payable,            // paid cards in this order
 *     costPence,          // amount charged now
 *     costFormatted,
 *     paymentIntentId,    // null when nothing was charged
 *     releaseAt,          // ISO — when the cron will post the order
 *     coolOffMinutes: 15,
 *   }
 *   On a declined card the response is 402 with { error } and NOTHING is held or
 *   dispatched. Over-cap sends return 403; no eligible leads 409.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { leadIds, action } = body as { leadIds?: string[]; action?: string }
  const isPreview = action === 'preview'

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'No leads selected' }, { status: 400 })
  }

  // Fetch profile for billing and design info
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
  const backUrl = profile.postcard_design_back_url as string | null
  const designsReady = Boolean(frontUrl && backUrl)

  // Fetch the selected leads. Exclude any that already have a postcard job so
  // the quantity (and therefore the cost) reflects only what will really be
  // sent — the atomic claim below is the true double-send guard.
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .in('id', leadIds)
    .is('postcard_job_id', null)

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 })
  }

  const used = (profile.postcards_used_this_period as number) ?? 0
  const eligible = leads ?? []
  const quantity = eligible.length

  // ── PREVIEW ──────────────────────────────────────────────────────────────
  if (isPreview) {
    const { included, overage, overageCostPence } = calculatePostcardCost(quantity, used)
    return NextResponse.json({
      preview: true,
      requested: leadIds.length,
      quantity,
      alreadySent: leadIds.length - quantity,
      used,
      includedRemaining: Math.max(0, INCLUDED_POSTCARDS_PER_MONTH - used),
      includedApplied: included,
      payable: overage,
      unitPricePence: POSTCARD_OVERAGE_PENCE,
      costPence: overageCostPence,
      costFormatted: formatPounds(overageCostPence),
      cap: MONTHLY_POSTCARD_CAP,
      capRemaining: Math.max(0, MONTHLY_POSTCARD_CAP - used),
      wouldExceedCap: used + quantity > MONTHLY_POSTCARD_CAP,
      designsReady,
    })
  }

  // ── CONFIRM ──────────────────────────────────────────────────────────────

  // Stannp prints whatever artwork we hand it, so both sides must exist before
  // we hold anything — no generic fallback card goes out under the user's name.
  if (!designsReady) {
    return NextResponse.json(
      { error: 'Add a front and back postcard design before sending. Open Postcard Design to upload them.' },
      { status: 400 }
    )
  }

  if (quantity === 0) {
    return NextResponse.json(
      { error: 'No eligible leads — they may already have been sent.' },
      { status: 409 }
    )
  }

  // Feature 6.3 — hard monthly cap. Fast, friendly rejection before we do any
  // work; the real enforcement is the atomic capped reservation below, which is
  // safe under concurrent sends.
  if (used + quantity > MONTHLY_POSTCARD_CAP) {
    return NextResponse.json(
      {
        error: `This would exceed your monthly limit of ${MONTHLY_POSTCARD_CAP} postcards. You have ${Math.max(0, MONTHLY_POSTCARD_CAP - used)} remaining this billing period.`,
      },
      { status: 403 }
    )
  }

  const adminSupabase = createAdminClient()
  const batchId = randomUUID()

  // 1. Create a pending job row per eligible lead and atomically claim the lead.
  //    Pending rows carry no release_at, so the cron never touches them; they
  //    only become live 'held' orders after the card charge succeeds. Leads that
  //    lose the claim race are skipped so we never charge for a card we can't
  //    send.
  type Claimed = { jobId: string; leadId: string; lead: Record<string, unknown> }
  const claimed: Claimed[] = []

  for (const lead of eligible) {
    let jobId: string | null = null
    try {
      const { data: jobRow, error: jobErr } = await adminSupabase
        .from('postcard_jobs')
        .insert({
          user_id: user.id,
          lead_id: lead.id,
          lead_month: lead.lead_month,
          recipient_address_line: lead.address_line,
          recipient_postcode: lead.postcode,
          batch_id: batchId,
          was_included_in_subscription: true,
          charge_amount_pence: 0,
          status: 'pending',
        })
        .select('id')
        .single()
      if (jobErr || !jobRow) throw new Error(jobErr?.message ?? 'Could not create postcard job')
      jobId = jobRow.id as string

      const { data: claimRows, error: claimErr } = await adminSupabase
        .from('leads')
        .update({ postcard_job_id: jobId, selected_for_dispatch: true })
        .eq('id', lead.id)
        .is('postcard_job_id', null)
        .select('id')
      if (claimErr) throw new Error(claimErr.message)
      if (!claimRows || claimRows.length === 0) {
        // Lost the race — cancel our pending row, send/charge nothing for it.
        await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).eq('id', jobId)
        continue
      }

      claimed.push({ jobId, leadId: lead.id as string, lead })
    } catch (err) {
      console.error(`Failed to reserve postcard job for lead ${lead.id}:`, err)
      if (jobId) {
        await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).eq('id', jobId)
        await adminSupabase.from('leads').update({ postcard_job_id: null }).eq('id', lead.id)
      }
    }
  }

  const q = claimed.length
  if (q === 0) {
    return NextResponse.json(
      { error: 'No eligible leads — they may already have been sent.' },
      { status: 409 }
    )
  }

  // Helper to undo everything reserved above (used on any failure past here).
  const releaseReservation = async () => {
    const jobIds = claimed.map((c) => c.jobId)
    const leadIdsToFree = claimed.map((c) => c.leadId)
    await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).in('id', jobIds)
    await adminSupabase.from('leads').update({ postcard_job_id: null, selected_for_dispatch: false }).in('id', leadIdsToFree)
  }

  // 2. Reserve q postcards against the period counter AND the hard cap, in one
  //    atomic, row-locked step. This is where usage is counted — at hold
  //    creation, never at release, so a released order is not double-counted and
  //    a cancelled one is cleanly given back. Returns the pre-increment usage so
  //    the included/paid split is deterministic and race-free.
  const { data: preUsedRaw, error: reserveErr } = await adminSupabase.rpc(
    'increment_postcards_used_capped',
    { p_user_id: user.id, p_amount: q, p_cap: MONTHLY_POSTCARD_CAP }
  )
  if (reserveErr) {
    await releaseReservation()
    console.error('Capped reservation RPC failed:', reserveErr)
    return NextResponse.json({ error: 'Could not reserve your postcard allowance. Please try again.' }, { status: 500 })
  }
  const preUsed = preUsedRaw as number
  if (preUsed < 0) {
    // Cap would be breached (e.g. a concurrent send got in first).
    await releaseReservation()
    return NextResponse.json(
      {
        error: `This would exceed your monthly limit of ${MONTHLY_POSTCARD_CAP} postcards. You have ${Math.max(0, MONTHLY_POSTCARD_CAP - used)} remaining this billing period.`,
      },
      { status: 403 }
    )
  }

  // 3. Split included vs paid from the reserved pre-usage value.
  const includedRemaining = Math.max(0, INCLUDED_POSTCARDS_PER_MONTH - preUsed)
  const includedCount = Math.min(q, includedRemaining)
  const payableCount = q - includedCount
  const costPence = payableCount * POSTCARD_OVERAGE_PENCE

  // 4. Charge the saved card UP FRONT for the paid cards (feature 8.6). A
  //    decline aborts the whole send: reservation released, holds cancelled,
  //    leads freed, nothing dispatched.
  let paymentIntentId: string | null = null
  if (payableCount > 0) {
    if (!profile.stripe_customer_id) {
      await adminSupabase.rpc('decrement_postcards_used', { p_user_id: user.id, p_amount: q })
      await releaseReservation()
      return NextResponse.json(
        { error: 'No payment method on file. Add a card in Billing before sending paid postcards.' },
        { status: 402 }
      )
    }
    try {
      const { paymentIntentId: pi } = await chargePostcardBatch({
        customerId: profile.stripe_customer_id as string,
        amountPence: costPence,
        // Stable per send: a retried confirm reuses the same batch id, so Stripe
        // dedupes and never double-charges.
        idempotencyKey: `postcard-batch:${batchId}`,
        metadata: { userId: user.id, batchId, payableCount: String(payableCount) },
      })
      paymentIntentId = pi
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Your card was declined.'
      await adminSupabase.rpc('decrement_postcards_used', { p_user_id: user.id, p_amount: q })
      await releaseReservation()
      return NextResponse.json({ error: msg }, { status: 402 })
    }
  }

  // 5. Charge is settled (or there was nothing to pay). Promote the pending rows
  //    to HELD with a release_at, tagging the paid cards with the PaymentIntent
  //    so cancel can refund them. Stannp is NOT called here — the release cron
  //    does that once the cool-off expires.
  const releaseAt = new Date(Date.now() + POSTCARD_COOL_OFF_MINUTES * 60_000).toISOString()
  const heldJobIds: string[] = []
  for (let i = 0; i < claimed.length; i++) {
    const { jobId } = claimed[i]
    const isIncluded = i < includedCount
    await adminSupabase
      .from('postcard_jobs')
      .update({
        status: 'held',
        release_at: releaseAt,
        was_included_in_subscription: isIncluded,
        charge_amount_pence: isIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
        stripe_payment_intent_id: isIncluded ? null : paymentIntentId,
      })
      .eq('id', jobId)
    heldJobIds.push(jobId)
  }

  // Record the purchase as an in-app notification (and email, per the user's
  // preference). Best-effort — never block the send response on it.
  await createNotification({
    userId: user.id,
    type: 'leads_purchased',
    title: `${q} postcard${q === 1 ? '' : 's'} on the way`,
    body:
      payableCount > 0
        ? `${includedCount} included and ${payableCount} paid (${formatPounds(costPence)}). You can cancel within ${POSTCARD_COOL_OFF_MINUTES} minutes.`
        : `All ${q} from your free monthly allowance. You can cancel within ${POSTCARD_COOL_OFF_MINUTES} minutes.`,
    href: '/postcards',
  })

  return NextResponse.json(
    {
      success: true,
      orderId: batchId,
      jobIds: heldJobIds,
      quantity: q,
      included: includedCount,
      payable: payableCount,
      costPence,
      costFormatted: formatPounds(costPence),
      paymentIntentId,
      releaseAt,
      coolOffMinutes: POSTCARD_COOL_OFF_MINUTES,
    },
    { status: 201 }
  )
}
