import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, chargePostcardBatch } from '@/lib/stripe/billing'
import { currentMonthKey } from '@/lib/utils/date'
import { createNotification } from '@/lib/notifications'
import { sendAdminAlert } from '@/lib/email/resend'
import { loadSuppressionKeys, isSuppressed } from '@/lib/leads/suppression'
import { resolveBackUrl } from '@/lib/postcards/defaults'
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

// A lead whose current job is still in one of these states can never be
// re-targeted: the card is queued to post or inside its cool-off window.
const IN_FLIGHT_STATUSES = new Set(['pending', 'held', 'dispatching'])

/**
 * POST: two actions.
 *
 *   action: 'preview'  — cost preview only. NOTHING is charged or dispatched.
 *   action: 'confirm'  — (the default) charge the saved card up front for any
 *                        payable cards, then create HELD orders that a cron
 *                        posts after a 15-minute cool-off (feature 6.4).
 *
 * Both accept `resend: true` ("Send again"): leads that already carry a
 * FINISHED postcard job are then eligible too, and are re-claimed from that old
 * job at confirm time. Nothing is detached up front, so closing the modal
 * leaves the lead exactly as it was (still in "Send again", still linked to
 * its history). Leads whose job is still in flight are never re-sendable.
 *
 * Confirm also accepts `expectedCostPence` / `expectedQuantity` — the figures
 * the user was shown. If the real cost or card count differs at confirm time
 * (another tab used up the free allowance, a lead lost a claim race, an address
 * was opted out in between) NOTHING is charged: the reservation is unwound and
 * a 409 with `costChanged: true` and a fresh preview is returned so the user
 * can confirm the new figures.
 *
 * ── Preview request  ────────────────────────────────────────────────────────
 *   { action: 'preview', leadIds: string[], resend?: boolean }
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
  const { leadIds, action, resend, expectedCostPence, expectedQuantity } = body as {
    leadIds?: string[]
    action?: string
    resend?: boolean
    expectedCostPence?: number
    expectedQuantity?: number
  }
  const isPreview = action === 'preview'
  const allowResend = resend === true

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
  // A template sets the front only; the back then prints as the blank default
  // (the printer adds the address over its right half), exactly as the design
  // page promises. So only the FRONT is required to send.
  const backUrl = resolveBackUrl(profile.postcard_design_back_url as string | null)
  const designsReady = Boolean(frontUrl)

  // Fetch the selected leads. A lead is eligible when it has no postcard job,
  // or — for "Send again" — when its job has FINISHED. In-flight jobs are
  // excluded so the quantity (and therefore the cost) reflects only what will
  // really be sent; the atomic claim below is the true double-send guard.
  const { data: leadRows, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .in('id', leadIds)

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 })
  }

  const linkedJobIds = (leadRows ?? [])
    .map((l) => l.postcard_job_id as string | null)
    .filter((id): id is string => Boolean(id))
  const jobStatus = new Map<string, string>()
  if (allowResend && linkedJobIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from('postcard_jobs')
      .select('id, status')
      .in('id', linkedJobIds)
    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 })
    }
    for (const j of jobs ?? []) jobStatus.set(j.id as string, j.status as string)
  }

  const leads = (leadRows ?? []).filter((l) => {
    const jobId = l.postcard_job_id as string | null
    if (!jobId) return true
    if (!allowResend) return false
    const status = jobStatus.get(jobId)
    return status !== undefined && !IN_FLIGHT_STATUSES.has(status)
  })

  const used = (profile.postcards_used_this_period as number) ?? 0

  // ── Do-not-contact screening (compliance) ──────────────────────────────────
  // Screen every eligible lead against the suppression list HERE, at send time —
  // not just at lead generation. An opt-out recorded after a batch dropped, a
  // "Send again", or a hand-typed custom address would otherwise still be posted.
  // loadSuppressionKeys fails CLOSED (throws on a transient read error), so a
  // blip refuses the send rather than silently posting to opted-out addresses.
  const adminScreen = createAdminClient()
  let suppressionKeys: Set<string>
  try {
    suppressionKeys = await loadSuppressionKeys(adminScreen)
  } catch (err) {
    console.error('Suppression screen failed for send:', err)
    return NextResponse.json(
      { error: 'We could not verify the do-not-contact list just now. Please try again shortly.' },
      { status: 503 }
    )
  }
  const notSuppressed = leads.filter(
    (l) => !isSuppressed(suppressionKeys, l.address_line as string, l.postcode as string)
  )
  const suppressedCount = leads.length - notSuppressed.length

  const eligible = notSuppressed
  const quantity = eligible.length

  const buildPreview = (qty: number, usedNow: number, suppressedNow: number) => {
    const { included, overage, overageCostPence } = calculatePostcardCost(qty, usedNow)
    return {
      preview: true as const,
      requested: leadIds.length,
      quantity: qty,
      suppressed: suppressedNow,
      alreadySent: leadIds.length - qty - suppressedNow,
      used: usedNow,
      includedRemaining: Math.max(0, INCLUDED_POSTCARDS_PER_MONTH - usedNow),
      includedApplied: included,
      payable: overage,
      unitPricePence: POSTCARD_OVERAGE_PENCE,
      costPence: overageCostPence,
      costFormatted: formatPounds(overageCostPence),
      cap: MONTHLY_POSTCARD_CAP,
      capRemaining: Math.max(0, MONTHLY_POSTCARD_CAP - usedNow),
      wouldExceedCap: usedNow + qty > MONTHLY_POSTCARD_CAP,
      designsReady,
    }
  }

  // ── PREVIEW ──────────────────────────────────────────────────────────────
  if (isPreview) {
    return NextResponse.json(buildPreview(quantity, used, suppressedCount))
  }

  // ── CONFIRM ──────────────────────────────────────────────────────────────

  // Stannp prints whatever artwork we hand it, so both sides must exist before
  // we hold anything — no generic fallback card goes out under the user's name.
  if (!designsReady || !frontUrl) {
    return NextResponse.json(
      { error: 'Add a postcard design before sending. Open Postcard Design to create or upload one.' },
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
  let lostClaimRace = 0

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

      // Claim the lead from exactly the state we evaluated it in: unlinked, or
      // (for a re-send) still linked to the finished job we saw. A concurrent
      // order that got in first changes that link, so its claim wins and ours
      // fails cleanly.
      const previousJobId = lead.postcard_job_id as string | null
      let claimQuery = adminSupabase
        .from('leads')
        .update({ postcard_job_id: jobId, selected_for_dispatch: true })
        .eq('id', lead.id)
      claimQuery = previousJobId
        ? claimQuery.eq('postcard_job_id', previousJobId)
        : claimQuery.is('postcard_job_id', null)
      const { data: claimRows, error: claimErr } = await claimQuery.select('id')
      if (claimErr) throw new Error(claimErr.message)
      if (!claimRows || claimRows.length === 0) {
        // Lost the race — cancel our pending row, send/charge nothing for it.
        await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).eq('id', jobId)
        lostClaimRace++
        continue
      }

      claimed.push({ jobId, leadId: lead.id as string, lead })
    } catch (err) {
      console.error(`Failed to reserve postcard job for lead ${lead.id}:`, err)
      if (jobId) {
        await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).eq('id', jobId)
        // Scope the unclaim to OUR job so a concurrent request that successfully
        // claimed the same lead isn't accidentally unlinked; a re-sent lead goes
        // back to its previous finished job.
        await adminSupabase.rpc('relink_lead_after_unwind', { p_lead_id: lead.id, p_job_id: jobId })
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
    await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).in('id', jobIds)
    // Free each lead scoped to the job that claimed it, so we can never unlink a
    // lead that a concurrent request has since claimed under a different job.
    // A re-sent lead is pointed back at its previous finished job.
    for (const c of claimed) {
      await adminSupabase.rpc('relink_lead_after_unwind', { p_lead_id: c.leadId, p_job_id: c.jobId })
    }
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

  // 3b. The figures the user confirmed must still be true. If the free
  //     allowance was used up in another tab, an address was opted out, or a
  //     lead lost its claim race, the cost or count has changed — so charge
  //     NOTHING, hand everything back and let the user confirm the new figures.
  const costChanged = typeof expectedCostPence === 'number' && expectedCostPence !== costPence
  const quantityChanged = typeof expectedQuantity === 'number' && expectedQuantity !== q
  if (costChanged || quantityChanged) {
    await adminSupabase.rpc('decrement_postcards_used', { p_user_id: user.id, p_amount: q })
    await releaseReservation()
    const fresh = buildPreview(q, preUsed, suppressedCount + lostClaimRace)
    return NextResponse.json(
      {
        error: costChanged
          ? `The price has changed since you previewed this order: it is now ${fresh.costFormatted} for ${q} card${q === 1 ? '' : 's'}. Please check and confirm again.`
          : `${q} of your selected lead${q === 1 ? '' : 's'} can now be sent (some were sent elsewhere or opted out). Please check and confirm again.`,
        costChanged: true,
        preview: fresh,
      },
      { status: 409 }
    )
  }

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
        // Keyed on THIS request's batch id. batchId is randomUUID() per request
        // (see above), so this only dedupes a transport-level retry of this exact
        // request — it does NOT dedupe a user's repeated confirm, which arrives
        // with a fresh batch id.
        idempotencyKey: `postcard-batch:${batchId}`,
        metadata: { userId: user.id, batchId, payableCount: String(payableCount) },
      })
      paymentIntentId = pi
    } catch (err) {
      const e = err as Error & { type?: string; code?: string }
      const isCardDecline =
        e.type === 'StripeCardError' ||
        e.code === 'card_declined' ||
        e.code === 'authentication_required' ||
        // No usable card on file: chargePostcardBatch throws BEFORE hitting
        // Stripe, so no money moved and it is safe to unwind and refuse. Without
        // this it fell through to the ambiguous path below and stranded the
        // leads + reserved allowance behind a 500.
        e.code === 'no_payment_method'

      if (isCardDecline) {
        // A genuine decline means no money moved, so it is safe to fully unwind
        // and refuse: hand back the reserved usage, cancel the holds, free the
        // leads, dispatch nothing.
        const msg = e.message || 'Your card was declined.'
        await adminSupabase.rpc('decrement_postcards_used', { p_user_id: user.id, p_amount: q })
        await releaseReservation()
        return NextResponse.json({ error: msg }, { status: 402 })
      }

      // Any OTHER failure (network/timeout, Stripe API error, or our own
      // non-succeeded guard): the charge MAY have actually gone through, so we
      // must NOT decrement usage or free the leads — that would risk a
      // charged-but-freed state. Leave the reservation and (still pending, so the
      // cron never posts them) holds in place for operator review, alert, and
      // return 500.
      const msg = e instanceof Error ? e.message : String(e)
      console.error(
        `Postcard charge failed (non-decline) for batch ${batchId}, user ${user.id}:`,
        msg
      )
      // Best-effort: a Resend outage here must not turn into an unhandled 500 that
      // masks the real "check with support" message below.
      try {
        await sendAdminAlert(
          `[Housepost] Postcard charge failed and needs review — batch ${batchId}`,
          `<p>A postcard charge for user <strong>${user.id}</strong> (batch <strong>${batchId}</strong>,
            ${payableCount} paid card${payableCount === 1 ? '' : 's'}, ${formatPounds(costPence)}) failed
            with a NON-decline error. The charge may have succeeded, so the reserved usage and pending
            holds were deliberately LEFT IN PLACE (not unwound) to avoid a charged-but-freed state.
            Please reconcile against Stripe.</p>
           <pre>${msg}</pre>`
        )
      } catch (alertErr) {
        console.error(`Failed to send charge-ambiguous alert for batch ${batchId}:`, alertErr)
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

  // 5. Charge is settled (or there was nothing to pay). Promote the pending rows
  //    to HELD with a release_at, tagging the paid cards with the PaymentIntent
  //    so cancel can refund them. Stannp is NOT called here — the release cron
  //    does that once the cool-off expires.
  const releaseAt = new Date(Date.now() + POSTCARD_COOL_OFF_MINUTES * 60_000).toISOString()
  const heldJobIds = claimed.map((c) => c.jobId)
  // The included cards are always the first `includedCount` of the batch.
  const paidJobIds = claimed.slice(includedCount).map((c) => c.jobId)

  // Promote every held row in ONE update, defaulting to included (free) and
  // snapshotting the designs AS THEY ARE NOW. The release cron prints from these
  // snapshot columns, so a design change or removal during the cool-off can't
  // alter or break what actually goes out versus what the user previewed.
  await adminSupabase
    .from('postcard_jobs')
    .update({
      status: 'held',
      release_at: releaseAt,
      was_included_in_subscription: true,
      charge_amount_pence: 0,
      stripe_payment_intent_id: null,
      held_design_front_url: frontUrl,
      held_design_back_url: backUrl,
    })
    .in('id', heldJobIds)

  // Then flip only the paid rows to carry the overage charge and the shared
  // PaymentIntent (so cancel can refund them). Two bulk updates in total, never
  // one round-trip per row.
  if (paidJobIds.length > 0) {
    await adminSupabase
      .from('postcard_jobs')
      .update({
        was_included_in_subscription: false,
        charge_amount_pence: POSTCARD_OVERAGE_PENCE,
        stripe_payment_intent_id: paymentIntentId,
      })
      .in('id', paidJobIds)
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
