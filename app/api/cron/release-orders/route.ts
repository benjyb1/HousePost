import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPostcard, buildRecipient } from '@/lib/postcards/stannp'

export const maxDuration = 60

// Bound the work per run so we stay inside maxDuration even when each Stannp
// call takes a moment. Any backlog beyond this drains on the next run (the
// workflow fires every ~5 minutes).
const MAX_ORDERS_PER_RUN = 100

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
 *     continues. A failed row is NOT auto-refunded (the charge stands) — see the
 *     handoff note in the PR; these need operator review.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()

  // Due held orders, oldest first.
  const { data: due, error: dueErr } = await supabase
    .from('postcard_jobs')
    .select('id, user_id, lead_id, lead_month, recipient_address_line, recipient_postcode')
    .eq('status', 'held')
    .lte('release_at', nowIso)
    .order('release_at', { ascending: true })
    .limit(MAX_ORDERS_PER_RUN)

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 })
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ success: true, released: 0, dispatched: 0, failed: 0, skipped: 0 })
  }

  // Fetch each distinct user's saved designs once.
  const userIds = [...new Set(due.map((j) => j.user_id as string))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, postcard_design_url, postcard_design_back_url')
    .in('id', userIds)
  const designs = new Map<string, { front: string | null; back: string | null }>()
  for (const p of profiles ?? []) {
    designs.set(p.id as string, {
      front: p.postcard_design_url as string | null,
      back: p.postcard_design_back_url as string | null,
    })
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
      .update({ status: 'dispatching' })
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
      const design = designs.get(job.user_id as string)
      if (!design?.front || !design?.back) {
        throw new Error('Postcard designs are missing for this account')
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
        frontUrl: design.front,
        backUrl: design.back,
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
      // Mark failed and keep going. The charge stands; operator review needed.
      await supabase.from('postcard_jobs').update({ status: 'failed' }).eq('id', jobId)
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
