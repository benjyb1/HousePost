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
  const { data: jobs, error } = await supabase
    .from('postcard_jobs')
    .select('id, postgrid_letter_id, status, postgrid_status')
    .not('postgrid_letter_id', 'is', null)
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

      // Write to BOTH columns during the postgrid_status → status transition.
      // The reading code uses `postgrid_status ?? status`, so writing
      // postgrid_status keeps the on-screen value fresh today, while status is
      // the single-column consolidation target the migration backfills. Once the
      // migration has relaxed the status CHECK, both accept the full pipeline
      // vocabulary; a job update that is somehow rejected is caught per-item
      // below so one bad row never aborts the batch.
      const { error: updateError } = await supabase
        .from('postcard_jobs')
        .update({ status: next, postgrid_status: next })
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
