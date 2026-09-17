import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPostcard, buildRecipient } from '@/lib/postcards/stannp'
import { refundPostcardCharge } from '@/lib/stripe/billing'
import { sendAdminAlert } from '@/lib/email/resend'
import {
  classifyDispatchError,
  describeCategory,
  retryDelayMinutes,
  MAX_RETRIES,
} from '@/lib/postcards/failure'
import { getPrintBalancePence, lowBalancePence } from '@/lib/postcards/stannp-account'
import { shouldAlert, clearAlert } from '@/lib/ops/state'
import {
  notifyCustomersDelayed,
  notifyCustomersFailed,
  type AffectedCard,
} from '@/lib/postcards/customer-notify'

export const maxDuration = 60

// Bound the work per run so we stay inside maxDuration even when each Stannp
// call takes a moment. Any backlog beyond this drains on the next run (the
// schedule fires every 5 minutes).
const MAX_ORDERS_PER_RUN = 100

// A row that has been in 'dispatching' longer than this almost certainly crashed
// mid-send (between the atomic claim and the status write). We alert on these but
// NEVER auto-retry them — the Stannp call may already have posted the card, so a
// retry could double-print.
const STUCK_DISPATCHING_MINUTES = 10

// A row left in 'pending' this long almost certainly comes from a charge whose
// outcome was ambiguous (network/timeout after the PaymentIntent was created):
// the send route deliberately does NOT unwind those, to avoid a charged-but-freed
// state. They carry no release_at so the cron never posts them, and nothing else
// sweeps them, so their leads stay claimed. Alert so an operator reconciles.
const STUCK_PENDING_MINUTES = 20

// How often the admin hears about an ongoing supplier-side problem. Hard
// failures (address/design) and the first sight of a new problem always email.
const DELAYED_ALERT_MINUTES = 60
const LOW_BALANCE_ALERT_MINUTES = 24 * 60

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Release cron (feature 6.4). Finds held postcard orders whose cool-off has
 * expired (status 'held', release_at <= now) and posts them via Stannp.
 *
 * Ordering guarantees:
 *   • Usage was already counted and the card already charged at hold creation,
 *     so this route counts NOTHING and charges NOTHING — it only dispatches.
 *   • Each row is atomically claimed 'held' -> 'dispatching' BEFORE Stannp is
 *     called. If the claim returns no row, a cancel beat us to it and we skip,
 *     so a card is never both refunded and posted.
 *   • A per-order failure is classified (lib/postcards/failure.ts):
 *       – a problem on OUR side (empty print balance, supplier down, bad
 *         credentials) puts the row back to 'held' with release_at pushed out
 *         on a backoff ladder. The customer keeps the card, keeps the charge,
 *         and is told it is delayed. It retries on its own once the problem
 *         clears, up to MAX_RETRIES, then is failed like any other.
 *       – a problem with THIS card (address, design) fails it now: the row is
 *         marked 'failed' with a plain-English reason, any up-front charge is
 *         refunded, the reserved allowance handed back, and the lead freed so
 *         it returns to New leads. The customer is told why.
 *     Either way the run continues with the next card.
 *   • Rows print from a per-order design SNAPSHOT captured at hold time, so a
 *     design change during the cool-off cannot alter what actually goes out.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()

  // Detect rows stuck in 'dispatching' from an earlier crashed run and alert on
  // them. We do NOT touch or retry them: the earlier Stannp call may already have
  // posted the card, so a retry could double-print. These need operator review.
  const stuckCutoffIso = new Date(
    Date.now() - STUCK_DISPATCHING_MINUTES * 60_000
  ).toISOString()
  const { data: stuck } = await supabase
    .from('postcard_jobs')
    .select('id, user_id, dispatching_at')
    .eq('status', 'dispatching')
    .lt('dispatching_at', stuckCutoffIso)
    .limit(MAX_ORDERS_PER_RUN)
  if (stuck && stuck.length > 0) {
    const ids = stuck.map((r) => r.id as string)
    console.error(
      `Release cron: ${stuck.length} postcard job(s) stuck in 'dispatching' (>${STUCK_DISPATCHING_MINUTES}m):`,
      ids.join(', ')
    )
    if (await shouldAlert(supabase, 'stuck-dispatching', DELAYED_ALERT_MINUTES)) {
      try {
        await sendAdminAlert(
          `[Housepost] ${stuck.length} postcard job(s) stuck 'dispatching' — needs review`,
          `<p><strong>${stuck.length}</strong> postcard job(s) have been in the transient
            <code>dispatching</code> state for over ${STUCK_DISPATCHING_MINUTES} minutes, which points to a
            crash mid-send. They were NOT auto-retried (a retry could double-print). Check the print
            account for each before deciding whether to mark them dispatched or failed:</p>
           <pre>${ids.join('\n')}</pre>`
        )
      } catch (alertErr) {
        console.error('Release cron: failed to send stuck-dispatching alert:', alertErr)
      }
    }
  }

  // Detect rows stuck in 'pending' (an ambiguous charge that we deliberately did
  // not unwind). Alert only — a human must decide, against Stripe, whether the
  // charge landed before freeing the leads and handing the allowance back.
  const pendingCutoffIso = new Date(
    Date.now() - STUCK_PENDING_MINUTES * 60_000
  ).toISOString()
  const { data: stuckPending } = await supabase
    .from('postcard_jobs')
    .select('id, user_id, batch_id')
    .eq('status', 'pending')
    .lt('created_at', pendingCutoffIso)
    .limit(MAX_ORDERS_PER_RUN)
  if (stuckPending && stuckPending.length > 0) {
    const ids = stuckPending.map((r) => r.id as string)
    console.error(
      `Release cron: ${stuckPending.length} postcard job(s) stuck 'pending' (>${STUCK_PENDING_MINUTES}m):`,
      ids.join(', ')
    )
    if (await shouldAlert(supabase, 'stuck-pending', DELAYED_ALERT_MINUTES)) {
      try {
        await sendAdminAlert(
          `[Housepost] ${stuckPending.length} postcard job(s) stuck 'pending' — needs review`,
          `<p><strong>${stuckPending.length}</strong> postcard job(s) have sat in <code>pending</code>
            for over ${STUCK_PENDING_MINUTES} minutes. This points to a charge whose outcome was
            ambiguous. Check Stripe for each batch before deciding whether to release, refund, or free
            the leads:</p><pre>${ids.join('\n')}</pre>`
        )
      } catch (alertErr) {
        console.error('Release cron: failed to send stuck-pending alert:', alertErr)
      }
    }
  }

  // Due held orders, oldest first. The `postgrid_letter_id IS NULL` guard is a
  // belt-and-braces stop against ever re-sending: a row that has already been
  // dispatched carries a letter id, so even if its status somehow flapped back to
  // 'held' it could never be picked up and posted twice.
  const { data: due, error: dueErr } = await supabase
    .from('postcard_jobs')
    .select('id, user_id, lead_id, lead_month, batch_id, recipient_address_line, recipient_postcode, held_design_front_url, held_design_back_url, stripe_payment_intent_id, charge_amount_pence, was_included_in_subscription, retry_count')
    .eq('status', 'held')
    .lte('release_at', nowIso)
    .is('postgrid_letter_id', null)
    .order('release_at', { ascending: true })
    .limit(MAX_ORDERS_PER_RUN)

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 })
  }

  let dispatched = 0
  let failed = 0
  let delayed = 0
  let skipped = 0
  const reasons: string[] = []
  const delayedCards: AffectedCard[] = []
  const failedCards: AffectedCard[] = []
  const rawErrors: { jobId: string; category: string; error: string; retry: number }[] = []

  for (const job of due ?? []) {
    const jobId = job.id as string

    // Atomically claim the row so a concurrent cancel (or overlapping cron run)
    // can't also act on it. Only a row still 'held' is claimable.
    const { data: claimed, error: claimErr } = await supabase
      .from('postcard_jobs')
      .update({ status: 'dispatching', dispatching_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'held')
      .select('id')
    if (claimErr) {
      failed++
      reasons.push(`${jobId}: claim error ${claimErr.message}`)
      continue
    }
    if (!claimed || claimed.length === 0) {
      // Cancelled or picked up elsewhere between the SELECT and now.
      skipped++
      continue
    }

    try {
      // Print from the design SNAPSHOT taken at hold time, never the live profile
      // designs — a change or removal during the cool-off must not alter or break
      // what actually goes out versus what the user previewed and paid for.
      const frontUrl = job.held_design_front_url as string | null
      const backUrl = job.held_design_back_url as string | null
      if (!frontUrl || !backUrl) {
        throw new Error('Postcard design snapshot is missing for this order')
      }

      const recipient = buildRecipient(
        job.recipient_address_line as string,
        job.recipient_postcode as string
      )

      const idempotencyKey = createHash('sha256')
        .update(`postcard:${job.user_id}:${job.lead_id}:${job.lead_month}`)
        .digest('hex')
        .slice(0, 40)

      const { id: postcardId, status } = await sendPostcard({
        to: recipient,
        frontUrl,
        backUrl,
        tag: idempotencyKey,
      })

      await supabase
        .from('postcard_jobs')
        .update({
          postgrid_letter_id: postcardId,
          postgrid_status: status,
          status: 'dispatched',
          dispatched_at: new Date().toISOString(),
          // A card that was delayed and then went out is no longer an error.
          last_error: null,
          last_error_at: null,
          failure_category: null,
        })
        .eq('id', jobId)

      dispatched++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Release dispatch failed for job ${jobId}:`, msg)

      const outcome = classifyDispatchError(msg)
      const previousRetries = (job.retry_count as number | null) ?? 0
      const common: AffectedCard = {
        userId: job.user_id as string,
        batchId: (job.batch_id as string | null) ?? null,
        jobId,
        addressLine: job.recipient_address_line as string,
        message: outcome.delayedMessage,
      }
      rawErrors.push({ jobId, category: outcome.category, error: msg, retry: previousRetries })

      // ── Our-side problem: keep the card, retry later ─────────────────────
      if (outcome.retryable && previousRetries < MAX_RETRIES) {
        const nextRetry = previousRetries + 1
        const releaseAt = new Date(
          Date.now() + retryDelayMinutes(nextRetry) * 60_000
        ).toISOString()
        await supabase
          .from('postcard_jobs')
          .update({
            status: 'held',
            release_at: releaseAt,
            dispatching_at: null,
            retry_count: nextRetry,
            last_error: msg,
            last_error_at: new Date().toISOString(),
            failure_category: outcome.category,
          })
          .eq('id', jobId)
        delayed++
        reasons.push(`${jobId}: delayed (${outcome.category}, retry ${nextRetry}) ${msg}`)
        // Tell the customer once, on the first delay — not on every retry.
        if (previousRetries === 0) delayedCards.push(common)
        continue
      }

      // ── This card cannot go: fail it and make the customer whole ─────────
      await supabase
        .from('postcard_jobs')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_category: outcome.category,
          failure_reason: outcome.failedMessage,
          last_error: msg,
          last_error_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // The card was NOT sent, so refund any up-front charge on this row and free
      // the lead so it returns to New leads. Without this a failed paid card
      // would be charged-but-never-sent, and the lead would sit under "Send
      // again" where it could be charged a second time.
      const paymentIntentId = job.stripe_payment_intent_id as string | null
      const chargePence = (job.charge_amount_pence as number | null) ?? 0
      const wasPaid = job.was_included_in_subscription === false
      if (wasPaid && paymentIntentId && chargePence > 0) {
        try {
          await refundPostcardCharge({
            paymentIntentId,
            amountPence: chargePence,
            // Per-job key: each failed card is refunded at most once even if the
            // cron re-encounters it, and other cards on the same PaymentIntent are
            // unaffected.
            idempotencyKey: `postcard-release-refund:${jobId}`,
          })
        } catch (refundErr) {
          const rmsg = refundErr instanceof Error ? refundErr.message : String(refundErr)
          console.error(`Release refund failed for job ${jobId}:`, rmsg)
          await supabase.from('postcard_jobs').update({ postgrid_status: 'refund_failed' }).eq('id', jobId)
          try {
            await sendAdminAlert(
              `[Housepost] Postcard send failed AND refund failed — job ${jobId}`,
              `<p>Postcard job <strong>${jobId}</strong> failed to send and the automatic refund of
                ${chargePence}p against PaymentIntent <strong>${paymentIntentId}</strong> also failed.
                Please refund manually in Stripe.</p><pre>${escapeHtml(rmsg)}</pre>`
            )
          } catch (alertErr) {
            console.error(`Release cron: failed to alert on refund failure for job ${jobId}:`, alertErr)
          }
          reasons.push(`${jobId}: send failed AND refund failed`)
        }
      }

      // Free the lead (scoped to this job) so it goes back to New leads — or,
      // for a re-send, back to its previous finished job — rather than staying
      // attached to a failed order.
      if (job.lead_id) {
        await supabase.rpc('relink_lead_after_unwind', {
          p_lead_id: job.lead_id as string,
          p_job_id: jobId,
        })
      }

      // Hand back the reserved allowance for this un-sent card (mirrors cancel),
      // so freeing the lead for re-send can't double-count usage.
      await supabase.rpc('decrement_postcards_used', {
        p_user_id: job.user_id as string,
        p_amount: 1,
      })

      failed++
      reasons.push(`${jobId}: failed (${outcome.category}) ${msg}`)
      failedCards.push({ ...common, message: outcome.failedMessage })
    }
  }

  // ── Tell people ─────────────────────────────────────────────────────────
  // Customers: one notification per batch, best-effort.
  try {
    if (delayedCards.length > 0) await notifyCustomersDelayed(delayedCards)
    if (failedCards.length > 0) await notifyCustomersFailed(failedCards)
  } catch (notifyErr) {
    console.error('Release cron: customer notification failed:', notifyErr)
  }

  // Admin: hard failures always; ongoing delays at most hourly per category.
  if (rawErrors.length > 0) {
    const hard = rawErrors.filter((e) => !classifyDispatchError(e.error).retryable)
    const categories = [...new Set(rawErrors.map((e) => e.category))]
    let send = hard.length > 0
    for (const c of categories) {
      if (await shouldAlert(supabase, `dispatch-${c}`, DELAYED_ALERT_MINUTES)) send = true
    }
    if (send) {
      const rows = rawErrors
        .map(
          (e) =>
            `<tr><td>${e.jobId}</td><td>${escapeHtml(describeCategory(e.category))}</td><td>${e.retry}</td><td><code>${escapeHtml(e.error)}</code></td></tr>`
        )
        .join('')
      try {
        await sendAdminAlert(
          `[Housepost] ${delayed} delayed, ${failed} failed postcard(s) on this run`,
          `<p>The release cron could not print every due card. Delayed cards retry on their own;
            failed cards were refunded and their leads freed. Open <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.housepost.co.uk'}/admin/ops">/admin/ops</a>.</p>
           <table border="1" cellpadding="4" cellspacing="0">
             <tr><th>Job</th><th>Category</th><th>Retries so far</th><th>Raw error</th></tr>${rows}
           </table>`
        )
      } catch (alertErr) {
        console.error('Release cron: failed to send dispatch alert:', alertErr)
      }
    }
  } else if (dispatched > 0) {
    // A clean run after trouble: let the next problem email straight away.
    await clearAlert(supabase, 'dispatch-print_credit')
    await clearAlert(supabase, 'dispatch-printer')
    await clearAlert(supabase, 'dispatch-unknown')
  }

  // ── Print balance watch ─────────────────────────────────────────────────
  // Cheap, once per run. Emails at most daily while the balance is under the
  // low-water mark, so an operator tops up before the next batch is refused.
  let balancePence: number | null = null
  try {
    balancePence = await getPrintBalancePence()
    if (balancePence !== null && balancePence < lowBalancePence()) {
      if (await shouldAlert(supabase, 'low-balance', LOW_BALANCE_ALERT_MINUTES)) {
        await sendAdminAlert(
          `[Housepost] Print balance low: £${(balancePence / 100).toFixed(2)}`,
          `<p>The prepaid print balance is <strong>£${(balancePence / 100).toFixed(2)}</strong>, below the
            £${(lowBalancePence() / 100).toFixed(2)} low-water mark. New sends are refused when the balance
            cannot cover them. Top up from <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.housepost.co.uk'}/admin/ops">/admin/ops</a>
            or switch on auto top-up in the print account.</p>`
        )
      }
    } else if (balancePence !== null) {
      await clearAlert(supabase, 'low-balance')
    }
  } catch (balErr) {
    console.error('Release cron: balance watch failed:', balErr)
  }

  return NextResponse.json({
    success: true,
    released: due?.length ?? 0,
    dispatched,
    delayed,
    failed,
    skipped,
    balancePence,
    ...(reasons.length > 0 ? { reasons } : {}),
  })
}

// Support GET for manual triggers / simple schedulers.
export async function GET(request: Request) {
  return POST(request)
}
