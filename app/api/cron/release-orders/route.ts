import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPostcard, buildRecipient } from '@/lib/postcards/stannp'
import { refundPostcardCharge } from '@/lib/stripe/billing'
import { sendAdminAlert } from '@/lib/email/resend'

export const maxDuration = 60

// Bound the work per run so we stay inside maxDuration even when each Stannp
// call takes a moment. Any backlog beyond this drains on the next run (the
// workflow fires every ~5 minutes).
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

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
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
 *   • Per-order failures are tolerated: the row is marked 'failed' and the run
 *     continues. Because the card was NOT sent, a failed row is also refunded
 *     (for paid cards), has its reserved allowance handed back, and its lead
 *     freed so it returns to New leads. A refund that itself fails raises an
 *     admin alert for manual reconciliation.
 *   • Rows that print from a per-order design SNAPSHOT captured at hold time, so a
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
    try {
      await sendAdminAlert(
        `[Housepost] ${stuck.length} postcard job(s) stuck 'dispatching' — needs review`,
        `<p><strong>${stuck.length}</strong> postcard job(s) have been in the transient
          <code>dispatching</code> state for over ${STUCK_DISPATCHING_MINUTES} minutes, which points to a
          crash mid-send. They were NOT auto-retried (a retry could double-print). Check Stannp for each
          before deciding whether to mark them dispatched or failed:</p>
         <pre>${ids.join('\n')}</pre>`
      )
    } catch (alertErr) {
      console.error('Release cron: failed to send stuck-dispatching alert:', alertErr)
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

  // Due held orders, oldest first. The `postgrid_letter_id IS NULL` guard is a
  // belt-and-braces stop against ever re-sending: a row that has already been
  // dispatched carries a letter id, so even if its status somehow flapped back to
  // 'held' it could never be picked up and posted twice.
  const { data: due, error: dueErr } = await supabase
    .from('postcard_jobs')
    .select('id, user_id, lead_id, lead_month, recipient_address_line, recipient_postcode, held_design_front_url, held_design_back_url, stripe_payment_intent_id, charge_amount_pence, was_included_in_subscription')
    .eq('status', 'held')
    .lte('release_at', nowIso)
    .is('postgrid_letter_id', null)
    .order('release_at', { ascending: true })
    .limit(MAX_ORDERS_PER_RUN)

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 })
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ success: true, released: 0, dispatched: 0, failed: 0, skipped: 0 })
  }

  let dispatched = 0
  let failed = 0
  let skipped = 0
  const reasons: string[] = []

  for (const job of due) {
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
        })
        .eq('id', jobId)

      dispatched++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Release dispatch failed for job ${jobId}:`, msg)

      // Mark failed and keep going.
      await supabase.from('postcard_jobs').update({ status: 'failed' }).eq('id', jobId)

      // The card was NOT sent, so make the user whole: refund any up-front charge
      // on this row and free the lead so it returns to New leads. Without this a
      // failed paid card would be charged-but-never-sent, and the lead would sit
      // under "Send again" where it could be charged a second time.
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
          try {
            await sendAdminAlert(
              `[Housepost] Postcard send failed AND refund failed — job ${jobId}`,
              `<p>Postcard job <strong>${jobId}</strong> failed to send and the automatic refund of
                ${chargePence}p against PaymentIntent <strong>${paymentIntentId}</strong> also failed.
                Please refund manually in Stripe.</p><pre>${rmsg}</pre>`
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
      reasons.push(`${jobId}: ${msg}`)
    }
  }

  return NextResponse.json({
    success: true,
    released: due.length,
    dispatched,
    failed,
    skipped,
    ...(reasons.length > 0 ? { reasons } : {}),
  })
}

// Support GET for manual triggers / simple schedulers.
export async function GET(request: Request) {
  return POST(request)
}
