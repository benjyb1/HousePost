/**
 * Standalone Land Registry import script for GitHub Actions.
 * Mirrors the logic in app/api/cron/import-land-registry/route.ts
 * but runs directly in Node.js with no function timeout limit.
 *
 * Usage: npx tsx scripts/run-import.ts
 */
import { isScheduledRunDay, toMonthKey } from '@/lib/cron/schedule'
import { runImport } from '@/lib/land-registry/importer'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminImportFailureAlert } from '@/lib/email/resend'

async function main() {
  const now = new Date()
  const importMonth = toMonthKey(now)

  console.log(`🗓  Today: ${now.toISOString().slice(0, 10)}`)

  if (!isScheduledRunDay(21, now)) {
    console.log('⏭  Not the scheduled run day — skipping.')
    process.exit(0)
  }

  const supabase = createAdminClient()

  // Prevent double-execution
  const { data: existingRun } = await supabase
    .from('pipeline_runs')
    .select('id, status')
    .eq('run_type', 'land_registry_import')
    .eq('import_month', importMonth)
    .eq('status', 'completed')
    .maybeSingle()

  if (existingRun) {
    console.log(`⏭  Already completed for ${importMonth} — skipping.`)
    process.exit(0)
  }

  const { data: runRow } = await supabase
    .from('pipeline_runs')
    .insert({ run_type: 'land_registry_import', status: 'started', import_month: importMonth })
    .select('id')
    .single()

  const runId = runRow?.id
  const startedAt = Date.now()

  try {
    console.log(`📥  Starting Land Registry import for ${importMonth}...`)
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

    console.log(`✅  Import complete:`, result)
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

    try { await sendAdminImportFailureAlert(errorMessage, importMonth) } catch {}

    console.error('❌  Import failed:', errorMessage)
    process.exit(1)
  }
}

main()
