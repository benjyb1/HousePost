import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchPostcardStatus,
  isTerminalStatus,
  TERMINAL_STATUSES,
} from '@/lib/postcards/stannp-status'

export const maxDuration = 60

// Poll a bounded slice each run so a single invocation never fans out to
// hundreds of upstream calls. In-flight cards are re-checked on the next run;
// the workflow runs a few times a day, which is ample for a multi-day pipeline.
const BATCH_SIZE = 100

// Only poll cards dispatched within this window. A postcard's fulfilment pipeline
// plays out over a few days; anything older is effectively terminal. This also
// stops the poller endlessly re-checking pre-Stannp legacy rows (old PostGrid
// letter ids that the current provider can't resolve, which just error every run).
const POLL_WINDOW_DAYS = 45

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Load dispatched jobs that carry a fulfilment item id but are not yet in a
  // terminal state. The value shown to users is `postgrid_status ?? status`, and
  // the fine-grained pipeline state lives in postgrid_status (status is set to
  // 'dispatched' at hand-off), so we filter on postgrid_status. A job whose
  // postgrid_status is somehow null still gets picked up defensively.
  const terminalList = (TERMINAL_STATUSES as readonly string[]).join(',')
  const windowStartIso = new Date(
    Date.now() - POLL_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const { data: jobs, error } = await supabase
    .from('postcard_jobs')
    .select('id, postgrid_letter_id, status, postgrid_status')
    .not('postgrid_letter_id', 'is', null)
    .gte('created_at', windowStartIso)
    .or(`postgrid_status.is.null,postgrid_status.not.in.(${terminalList})`)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Second guard in code: the displayed status is COALESCE(postgrid_status,
  // status), so skip anything already terminal by either column.
  const pending = (jobs ?? []).filter((job) => {
    const current = (job.postgrid_status ?? job.status) as string | null
    return !isTerminalStatus(current)
  })

  let checked = 0
  let updated = 0
  let failed = 0

  for (const job of pending) {
    const itemId = job.postgrid_letter_id as string | null
    if (!itemId) continue
    checked++

    try {
      const next = await fetchPostcardStatus(itemId)
      if (!next) continue

      const current = (job.postgrid_status ?? job.status) as string | null
      if (next === current) continue

      // Write ONLY the fine-grained pipeline state to postgrid_status, and NEVER
      // touch the coarse `status` column. `status` stays 'dispatched' from
      // hand-off onward, which is what the money paths rely on: billPendingOverage
      // and the retry-billing sweep both key on status = 'dispatched', and the
      // dashboard "postcards sent" count treats 'dispatched' as sent. If we also
      // wrote `status = 'printed' / 'delivered' / ...` here it would rewind the
      // lifecycle out from under those queries and unbilled overage would become
      // invisible. The Tracking UI reads `postgrid_status ?? status`, so writing
      // postgrid_status alone keeps the on-screen status fully live.
      const { error: updateError } = await supabase
        .from('postcard_jobs')
        .update({ postgrid_status: next })
        .eq('id', job.id)

      if (updateError) {
        failed++
        console.error(
          `poll-postcard-status: could not update job ${job.id}:`,
          updateError.message
        )
        continue
      }
      updated++
    } catch (err) {
      // Tolerate individual upstream failures — log and keep going.
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`poll-postcard-status: job ${job.id} status check failed:`, msg)
    }
  }

  return NextResponse.json({
    success: true,
    scanned: jobs?.length ?? 0,
    checked,
    updated,
    failed,
  })
}

// GitHub Actions triggers this with a GET; mirror the POST handler.
export async function GET(request: Request) {
  return POST(request)
}
