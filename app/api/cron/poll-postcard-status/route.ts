import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchPostcardStatus,
  isTerminalStatus,
  TERMINAL_STATUSES,
} from '@/lib/postcards/stannp-status'
import {
  notifyStatusChanges,
  isNotifiableStatus,
  type StatusChange,
} from '@/lib/postcards/customer-notify'
import { verifyCronRequest } from '@/lib/cron/auth'

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

// Where the last run stopped, kept in ops_state. Each run carries on from
// there (oldest first) and starts again from the top once it reaches the end,
// so every in-flight card gets its turn. Ordering by updated_at used to poll
// the same 100 cards forever once more than 100 were waiting, because a card
// whose status hasn't moved is never written to.
const CURSOR_KEY = 'poll-postcard-status:cursor'
type Cursor = { createdAt: string; id: string }

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
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
  const { data: cursorRow } = await supabase.from('ops_state').select('value').eq('key', CURSOR_KEY).maybeSingle()
  const saved = cursorRow?.value as Partial<Cursor> | null | undefined
  const cursor: Cursor | null =
    saved && typeof saved.createdAt === 'string' && typeof saved.id === 'string' && saved.createdAt >= windowStartIso
      ? { createdAt: saved.createdAt, id: saved.id }
      : null

  const slice = (after: Cursor | null, limit: number) => {
    let q = supabase
      .from('postcard_jobs')
      .select('id, user_id, postgrid_letter_id, status, postgrid_status, created_at')
      .not('postgrid_letter_id', 'is', null)
      .gte('created_at', windowStartIso)
      .or(`postgrid_status.is.null,postgrid_status.not.in.(${terminalList})`)
    if (after) {
      // Rows in one order share a created_at, so the id breaks the tie.
      // Values are quoted: a timestamp carries dots, colons and a "+".
      q = q.or(`created_at.gt."${after.createdAt}",and(created_at.eq."${after.createdAt}",id.gt."${after.id}")`)
    }
    return q.order('created_at', { ascending: true }).order('id', { ascending: true }).limit(limit)
  }

  const firstSlice = await slice(cursor, BATCH_SIZE)
  if (firstSlice.error) {
    console.error('poll-postcard-status: could not read jobs:', firstSlice.error)
    return NextResponse.json({ error: firstSlice.error.message }, { status: 500 })
  }
  let jobs = firstSlice.data ?? []
  let reachedEnd = jobs.length < BATCH_SIZE
  if (reachedEnd && cursor) {
    // Past the end: wrap round to the oldest cards for the rest of this run.
    const wrap = await slice(null, BATCH_SIZE - jobs.length)
    if (!wrap.error) {
      const seen = new Set(jobs.map((j) => j.id))
      jobs = [...jobs, ...(wrap.data ?? []).filter((j) => !seen.has(j.id))]
      reachedEnd = (wrap.data ?? []).length < BATCH_SIZE - firstSlice.data!.length
    }
  }
  const last = jobs[jobs.length - 1]
  const nextCursor: Cursor | null = reachedEnd || !last ? null : { createdAt: last.created_at as string, id: last.id as string }
  const { error: cursorErr } = nextCursor
    ? await supabase.from('ops_state').upsert({ key: CURSOR_KEY, value: nextCursor, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    : await supabase.from('ops_state').delete().eq('key', CURSOR_KEY)
  if (cursorErr) console.error('poll-postcard-status: could not save cursor:', cursorErr.message)

  // Second guard in code: the displayed status is COALESCE(postgrid_status,
  // status), so skip anything already terminal by either column.
  const pending = (jobs ?? []).filter((job) => {
    const current = (job.postgrid_status ?? job.status) as string | null
    return !isTerminalStatus(current)
  })

  let checked = 0
  let updated = 0
  let failed = 0
  const changes: StatusChange[] = []

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
      //
      // Compare-and-set on the value we read: pg_cron and the GitHub workflow
      // both fire this every six hours, and only the run that actually moves
      // the status may tell the customer about it.
      let cas = supabase
        .from('postcard_jobs')
        .update({ postgrid_status: next })
        .eq('id', job.id)
      cas = job.postgrid_status == null
        ? cas.is('postgrid_status', null)
        : cas.eq('postgrid_status', job.postgrid_status as string)
      const { data: moved, error: updateError } = await cas.select('id')

      if (updateError) {
        failed++
        console.error(
          `poll-postcard-status: could not update job ${job.id}:`,
          updateError.message
        )
        continue
      }
      if (!moved || moved.length === 0) continue // another run got there first
      updated++
      if (isNotifiableStatus(next)) {
        changes.push({ userId: job.user_id as string, status: next })
      }
    } catch (err) {
      // Tolerate individual upstream failures — log and keep going.
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`poll-postcard-status: job ${job.id} status check failed:`, msg)
    }
  }

  // Grouped customer notifications (fix list 7.2). Best-effort: a notification
  // problem must never fail the poll, which has already saved the statuses.
  try {
    if (changes.length > 0) await notifyStatusChanges(changes)
  } catch (err) {
    console.error('poll-postcard-status: customer notification failed:', err)
  }

  return NextResponse.json({
    success: true,
    scanned: jobs?.length ?? 0,
    checked,
    updated,
    failed,
    notified: changes.length,
  })
}

// GitHub Actions triggers this with a GET; mirror the POST handler.
export async function GET(request: Request) {
  return POST(request)
}
