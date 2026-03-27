import { NextResponse } from 'next/server'
import { isScheduledRunDay, toMonthKey } from '@/lib/cron/schedule'
import { runImport } from '@/lib/land-registry/importer'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminImportFailureAlert } from '@/lib/email/resend'

export const maxDuration = 60

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const importMonth = toMonthKey(now)

  // Only run on the scheduled day (21st, deferred to Monday if weekend)
  if (!isScheduledRunDay(21, now)) {
    return NextResponse.json({
      skipped: true,
      reason: 'Not the scheduled run day',
      today: now.toISOString().slice(0, 10),
    })
  }

  const supabase = createAdminClient()

  // Prevent double-execution: check if we already completed a run for this month
  const { data: existingRun } = await supabase
    .from('pipeline_runs')
    .select('id, status')
    .eq('run_type', 'land_registry_import')
    .eq('import_month', importMonth)
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle()

  if (existingRun) {
    return NextResponse.json({
      skipped: true,
      reason: 'Already completed for this month',
      importMonth,
    })
  }

  // Create audit row
  const { data: runRow } = await supabase
    .from('pipeline_runs')
    .insert({
      run_type: 'land_registry_import',
      status: 'started',
      import_month: importMonth,
    })
    .select('id')
    .single()

  const runId = runRow?.id
  const startedAt = Date.now()

  try {
    const result = await runImport(importMonth)

    await supabase
      .from('pipeline_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startedAt) / 1000),
        rows_downloaded: result.rowsDownloaded,
        rows_inserted: result.rowsInserted,
        rows_skipped: result.rowsSkipped,
      })
      .eq('id', runId)

    return NextResponse.json({ success: true, importMonth, ...result })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? err.stack : undefined

    await supabase
      .from('pipeline_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startedAt) / 1000),
        error_message: errorMessage,
        error_stack: errorStack,
      })
      .eq('id', runId)

    // Alert admin
    try {
      await sendAdminImportFailureAlert(errorMessage, importMonth)
    } catch {
      // Don't let email failure hide the original error
    }

    console.error('Land Registry import failed:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// Also support GET for manual triggers from the Vercel cron dashboard
export async function GET(request: Request) {
  return POST(request)
}
