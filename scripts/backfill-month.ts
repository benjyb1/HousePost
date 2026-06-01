/**
 * One-off backfill for a month whose monthly run was missed.
 * Generates leads with the correct lead_month and records an audit row.
 * Does NOT send notification emails (it calls generateLeadsForAllUsers directly).
 *
 * Usage:
 *   npx tsx scripts/backfill-month.ts 2026-04            # geocode existing import + generate
 *   npx tsx scripts/backfill-month.ts 2026-05 --import   # re-import first, then generate
 */
import { runImport } from '@/lib/land-registry/importer'
import { generateLeadsForAllUsers } from '@/lib/leads/generator'
import { createAdminClient } from '@/lib/supabase/admin'

async function main() {
  const month = process.argv[2]
  const doImport = process.argv.includes('--import')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    console.error('usage: backfill-month.ts <YYYY-MM> [--import]')
    process.exit(1)
  }

  const supabase = createAdminClient()
  const startedAt = Date.now()

  if (doImport) {
    console.log(`📥  Importing Land Registry data tagged ${month}...`)
    const imp = await runImport(month)
    console.log('   import:', imp)
    await supabase.from('pipeline_runs').insert({
      run_type: 'land_registry_import',
      status: 'completed',
      import_month: month,
      completed_at: new Date().toISOString(),
      rows_downloaded: imp.rowsDownloaded,
      rows_inserted: imp.rowsInserted,
      rows_skipped: imp.rowsSkipped,
    })
  }

  console.log(`🔍  Backfilling leads for ${month}...`)
  const res = await generateLeadsForAllUsers(month)
  console.log('   result:', res)

  await supabase.from('pipeline_runs').insert({
    run_type: 'lead_generation',
    status: 'completed',
    import_month: month,
    completed_at: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - startedAt) / 1000),
    users_processed: res.usersProcessed,
    leads_generated: res.totalLeads,
    users_at_max_radius: res.usersAtMaxRadius,
    emails_sent: 0,
    error_message:
      res.errors.length > 0
        ? res.errors.join('\n')
        : 'Backfilled 2026-06-01 (no emails sent)',
  })

  console.log(`✅  Done: ${res.totalLeads} leads for ${month}`)
}

main()
