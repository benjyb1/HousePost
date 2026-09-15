import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

// Retention windows (feature 8.9). Kept as named constants so the policy is
// obvious and easy to tune.
const ARCHIVE_AFTER_MONTHS = 3 // unused leads are archived once this old
const DELETE_AFTER_MONTHS = 3 // archived leads are deleted this long after archiving

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

/** now minus `months` calendar months, as an ISO timestamp. */
function monthsAgoIso(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}

/**
 * Leads retention cron (feature 8.9). Runs daily and does two sweeps across all
 * users with the service-role client:
 *
 *   1. ARCHIVE — unused leads (postcard_job_id IS NULL) that have sat in an
 *      account for ARCHIVE_AFTER_MONTHS get archived_at set to now(), moving
 *      them to the "Archived" tab.
 *
 *   2. DELETE — leads archived more than DELETE_AFTER_MONTHS ago are permanently
 *      removed. This covers both auto-archived leads and ones the user archived
 *      by hand, giving an unused lead a ~6-month maximum lifetime.
 *
 * Send history is protected two ways: every query is scoped with
 * `postcard_job_id IS NULL`, so a lead that has ever been sent is never archived
 * or deleted here, and the history itself lives in `postcard_jobs`, which this
 * route never touches.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // ── Step 1: archive unused leads older than the archive window ─────────────
  const archiveCutoff = monthsAgoIso(ARCHIVE_AFTER_MONTHS)
  const { data: archivedRows, error: archiveErr } = await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString() })
    .is('archived_at', null)
    .is('postcard_job_id', null)
    .lt('created_at', archiveCutoff)
    .select('id')

  if (archiveErr) {
    return NextResponse.json({ error: `archive step failed: ${archiveErr.message}` }, { status: 500 })
  }

  // ── Step 2: delete leads archived longer ago than the delete window ────────
  // Never delete a lead that is linked to send history (postcard_job_id set).
  const deleteCutoff = monthsAgoIso(DELETE_AFTER_MONTHS)
  const { data: deletedRows, error: deleteErr } = await supabase
    .from('leads')
    .delete()
    .not('archived_at', 'is', null)
    .is('postcard_job_id', null)
    .lt('archived_at', deleteCutoff)
    .select('id')

  if (deleteErr) {
    return NextResponse.json({ error: `delete step failed: ${deleteErr.message}` }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    archived: archivedRows?.length ?? 0,
    deleted: deletedRows?.length ?? 0,
    archiveCutoff,
    deleteCutoff,
  })
}

// GitHub Actions triggers cron endpoints with a GET; mirror the POST handler.
export async function GET(request: Request) {
  return POST(request)
}
