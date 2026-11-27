import { NextResponse, after } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, chargePostcardBatch } from '@/lib/stripe/billing'
import { currentMonthKey } from '@/lib/utils/date'
import { createNotification } from '@/lib/notifications'
import { sendAdminAlert } from '@/lib/email/resend'
import { loadSuppressionKeys, isSuppressed } from '@/lib/leads/suppression'
import { resolveBackUrl } from '@/lib/postcards/defaults'
import { checkPrintCapacity } from '@/lib/postcards/stannp-account'
import { markAlerted, shouldAlert } from '@/lib/ops/state'
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

  if (error) {
    console.error('[GET /api/postcards]', error)
    return NextResponse.json({ error: 'Could not load your postcards just now. Please try again.' }, { status: 500 })
  }
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
    if (profileError) console.error('Send: profile read failed:', profileError)
    return NextResponse.json({ error: 'We couldn’t load your account just now. Please try again.' }, { status: 404 })
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
    console.error('Send: leads read failed:', leadsError)
    return NextResponse.json({ error: 'We couldn’t load those homes just now. Please try again.' }, { status: 500 })
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
      console.error('Send: jobs read failed:', jobsError)
      return NextResponse.json({ error: 'We couldn’t load those homes just now. Please try again.' }, { status: 500 })
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
      { error: 'No eligible leads. They may already have been sent.' },
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

  // Pre-flight: can the prepaid print balance actually cover this batch? If we
  // positively know it cannot, refuse now — BEFORE any lead is claimed or any
  // card charged — rather than holding the cards for fifteen minutes and then
  // failing them. An unknown balance (supplier blip) never blocks a send.
  const capacity = await checkPrintCapacity(eligible.length)
  if (!capacity.ok) {
    console.error(
      `Send refused: print balance ${capacity.balancePence}p cannot cover ${eligible.length} card(s) (${capacity.neededPence}p)`
    )
    if (await shouldAlert(adminSupabase, 'send-refused-balance', 60)) {
      try {
        await sendAdminAlert(
          `[Housepost] Send refused: print balance too low`,
          `<p>A customer tried to send <strong>${eligible.length}</strong> postcard(s) but the prepaid print
            balance is <strong>£${((capacity.balancePence ?? 0) / 100).toFixed(2)}</strong>, short of the
            £${(capacity.neededPence / 100).toFixed(2)} needed. Nothing was charged. Top up from
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.housepost.co.uk'}/admin/ops">/admin/ops</a>.</p>`
        )
        await markAlerted(adminSupabase, 'send-refused-balance')
      } catch (alertErr) {
        console.error('Failed to send balance-refusal alert:', alertErr)
      }
    }
    return NextResponse.json(
      {
        error:
          'We cannot take new postcard orders right now because of a problem on our side. Nothing has been charged. Please try again in a few hours, or email info@housepost.co.uk if it keeps happening.',
        serviceUnavailable: true,
      },
      { status: 503 }
    )
  }

  // 1. Create a pending job row per eligible lead and atomically claim the lead.
  //    Pending rows carry no release_at, so the cron never touches them; they
  //    only become live 'held' orders after the card charge succeeds. Leads that
  //    lose the claim race are skipped so we never charge for a card we can't
  //    send.
  //
  //    All the job rows go in one insert. Each claim is a conditional update of
  //    its own lead (a different job id and starting state per lead), so those
  //    run in parallel, a few at a time, rather than one after another. The
  //    claimed list keeps the order the leads came in, which decides which
  //    cards are the included ones.
  type Claimed = { jobId: string; leadId: string; lead: Record<string, unknown> }
  const claimed: Claimed[] = []
  let lostClaimRace = 0

  const { data: jobRows, error: jobErr } = await adminSupabase
    .from('postcard_jobs')
    .insert(
      eligible.map((lead) => ({
        user_id: user.id,
        lead_id: lead.id,
        lead_month: lead.lead_month,
        recipient_address_line: lead.address_line,
        recipient_postcode: lead.postcode,
        batch_id: batchId,
        was_included_in_subscription: true,
        charge_amount_pence: 0,
        status: 'pending',
      }))
    )
    .select('id, lead_id')
  if (jobErr || !jobRows || jobRows.length !== eligible.length) {
    console.error(`Send: could not create postcard jobs for batch ${batchId}:`, jobErr ?? `${jobRows?.length ?? 0} of ${eligible.length} rows`)
    if (jobRows?.length) {
      await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).in('id', jobRows.map((r) => r.id as string))
    }
    return NextResponse.json({ error: 'We couldn’t place your order just now. Nothing has been charged. Please try again.' }, { status: 500 })
  }
  const jobIdByLead = new Map(jobRows.map((r) => [r.lead_id as string, r.id as string]))

  type ClaimResult = 'claimed' | 'lost' | 'error'
  const claimOne = async (lead: Record<string, unknown>, jobId: string): Promise<ClaimResult> => {
    // Claim the lead from exactly the state we evaluated it in: unlinked, or
    // (for a re-send) still linked to the finished job we saw. A concurrent
    // order that got in first changes that link, so its claim wins and ours
    // fails cleanly.
    const previousJobId = lead.postcard_job_id as string | null
    let claimQuery = adminSupabase
      .from('leads')
      .update({ postcard_job_id: jobId, selected_for_dispatch: true })
      .eq('id', lead.id as string)
    claimQuery = previousJobId
      ? claimQuery.eq('postcard_job_id', previousJobId)
      : claimQuery.is('postcard_job_id', null)
    const { data: claimRows, error: claimErr } = await claimQuery.select('id')
    if (claimErr) {
      console.error(`Failed to claim lead ${lead.id} for job ${jobId}:`, claimErr)
      return 'error'
    }
    return claimRows && claimRows.length > 0 ? 'claimed' : 'lost'
  }

  const results: ClaimResult[] = new Array(eligible.length)
  const CLAIM_CONCURRENCY = 10
  for (let i = 0; i < eligible.length; i += CLAIM_CONCURRENCY) {
    const slice = eligible.slice(i, i + CLAIM_CONCURRENCY)
    const out = await Promise.all(slice.map((lead) => claimOne(lead, jobIdByLead.get(lead.id as string)!)))
    out.forEach((r, j) => { results[i + j] = r })
  }

  const notClaimedJobIds: string[] = []
  const erroredLeads: { leadId: string; jobId: string }[] = []
  eligible.forEach((lead, i) => {
    const jobId = jobIdByLead.get(lead.id as string)!
    if (results[i] === 'claimed') {
      claimed.push({ jobId, leadId: lead.id as string, lead })
      return
    }
    notClaimedJobIds.push(jobId)
    if (results[i] === 'lost') lostClaimRace++
    else erroredLeads.push({ leadId: lead.id as string, jobId })
  })
  if (notClaimedJobIds.length > 0) {
    // Send and charge nothing for these.
    await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).in('id', notClaimedJobIds)
    // A claim that errored may still have landed: unlink it, scoped to OUR job
    // so a concurrent request that claimed the same lead isn't touched; a
    // re-sent lead goes back to its previous finished job.
    for (const e of erroredLeads) {
      await adminSupabase.rpc('relink_lead_after_unwind', { p_lead_id: e.leadId, p_job_id: e.jobId })
    }
  }

  const q = claimed.length
  if (q === 0) {
    return NextResponse.json(
      { error: 'No eligible leads. They may already have been sent.' },
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
        { error: 'No payment method on file. Add a card in Account before sending paid postcards.' },
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
          `[Housepost] Postcard charge failed and needs review – batch ${batchId}`,
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
            'Something went wrong while taking payment. Our team has been notified. Please check with support before trying again.',
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

  // Tag the paid cards with the overage charge and the shared PaymentIntent
  // FIRST, while every row is still 'pending' (which the cron never posts), so
  // no card can go live without what cancel needs to refund it. Then promote
  // every row to 'held' in one update, snapshotting the designs AS THEY ARE
  // NOW: the release cron prints from these snapshot columns, so a design change
  // or removal during the cool-off can't alter what actually goes out. The
  // included rows already carry their defaults from the insert above.
  // Each write is checked, and tried twice before giving up.
  const writeTwice = async (label: string, write: () => PromiseLike<{ error: { message: string } | null }>) => {
    const first = await write()
    if (!first.error) return null
    console.error(`Send ${batchId}: ${label} failed, trying once more:`, first.error)
    return (await write()).error
  }

  let writeError: { message: string } | null = null
  let failedStep = ''
  if (paidJobIds.length > 0) {
    writeError = await writeTwice('tag paid cards', () =>
      adminSupabase
        .from('postcard_jobs')
        .update({
          was_included_in_subscription: false,
          charge_amount_pence: POSTCARD_OVERAGE_PENCE,
          stripe_payment_intent_id: paymentIntentId,
        })
        .in('id', paidJobIds)
    )
    if (writeError) failedStep = 'recording the charge on the paid cards'
  }
  if (!writeError) {
    writeError = await writeTwice('promote to held', () =>
      adminSupabase
        .from('postcard_jobs')
        .update({
          status: 'held',
          release_at: releaseAt,
          held_design_front_url: frontUrl,
          held_design_back_url: backUrl,
        })
        .in('id', heldJobIds)
        .eq('status', 'pending')
    )
    if (writeError) failedStep = 'moving the cards into the send queue'
  }

  if (writeError) {
    if (payableCount === 0) {
      // Nothing was charged, so hand everything back and say so.
      await adminSupabase.rpc('decrement_postcards_used', { p_user_id: user.id, p_amount: q })
      await releaseReservation()
      return NextResponse.json(
        { error: 'We couldn’t place your order just now. Nothing has been charged. Please try again.' },
        { status: 500 }
      )
    }
    // The card WAS charged. The rows are still 'pending', so nothing prints
    // and the stuck-pending check will flag them too. Don't unwind: a person
    // reconciles against Stripe, as for an unclear charge.
    console.error(`Send ${batchId}: paid ${formatPounds(costPence)} (${paymentIntentId}) but ${failedStep} failed:`, writeError)
    try {
      await sendAdminAlert(
        `[Housepost] Paid order not queued – batch ${batchId}`,
        `<p>User <strong>${user.id}</strong> was charged <strong>${formatPounds(costPence)}</strong>
          (PaymentIntent <strong>${paymentIntentId}</strong>) for ${q} card(s) in batch <strong>${batchId}</strong>,
          but ${failedStep} failed, so the cards are still <code>pending</code> and will not print. Either
          finish the order (paid rows need <code>stripe_payment_intent_id</code>, all rows <code>held</code>
          with a <code>release_at</code> and the design snapshots) or refund it and free the leads.</p>
         <pre>${writeError.message}</pre>`
      )
    } catch (alertErr) {
      console.error(`Failed to send paid-not-queued alert for batch ${batchId}:`, alertErr)
    }
    return NextResponse.json(
      {
        error: `Your payment of ${formatPounds(costPence)} went through, but we couldn’t finish setting up the order, so nothing will be posted yet. Our team has been told and will either send the cards or refund you. Please don’t send these homes again in the meantime.`,
      },
      { status: 500 }
    )
  }

  // Record the purchase as an in-app notification (and email, per the user's
  // preference). Best-effort, and sent after the response so the send isn't
  // kept waiting on it.
  after(async () => {
    try {
      await createNotification({
        userId: user.id,
        type: 'leads_purchased',
        title: `${q} postcard${q === 1 ? '' : 's'} on the way`,
        body:
          payableCount > 0
            ? `${includedCount} included and ${payableCount} paid (${formatPounds(costPence)}). You can cancel within ${POSTCARD_COOL_OFF_MINUTES} minutes.`
            : // Never "All 2 from your allowance": it reads as if the allowance is 2.
              `${q} postcard${q === 1 ? '' : 's'} from your allowance. You can cancel within ${POSTCARD_COOL_OFF_MINUTES} minutes.`,
        href: '/postcards',
      })
    } catch (err) {
      console.error(`Send ${batchId}: notification failed:`, err)
    }
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
