/**
 * Standalone lead generation script for GitHub Actions.
 * Mirrors the logic in app/api/cron/generate-leads/route.ts
 * but runs directly in Node.js with no function timeout limit.
 *
 * Usage: npx tsx scripts/run-generate-leads.ts
 */
import { isScheduledRunDay, toMonthKey } from '@/lib/cron/schedule'
import { generateLeadsForAllUsers } from '@/lib/leads/generator'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLeadsReadyEmail } from '@/lib/email/resend'

async function main() {
  const now = new Date()
  const leadMonth = toMonthKey(now)

  console.log(`🗓  Today: ${now.toISOString().slice(0, 10)}`)

  if (!isScheduledRunDay(22, now)) {
    console.log('⏭  Not the scheduled run day — skipping.')
    process.exit(0)
  }

  const supabase = createAdminClient()

  // Prevent double-execution
  const { data: existingRun } = await supabase
    .from('pipeline_runs')
    .select('id')
    .eq('run_type', 'lead_generation')
    .eq('import_month', leadMonth)
    .eq('status', 'completed')
    .maybeSingle()

  if (existingRun) {
    console.log(`⏭  Already run for ${leadMonth} — skipping.`)
    process.exit(0)
  }

  // Check import ran first
  const { data: importRun } = await supabase
    .from('pipeline_runs')
    .select('id')
    .eq('run_type', 'land_registry_import')
    .eq('import_month', leadMonth)
    .eq('status', 'completed')
    .maybeSingle()

  if (!importRun) {
    console.error('❌  Land Registry import has not completed for this month yet.')
    process.exit(1)
  }

  const { data: runRow } = await supabase
    .from('pipeline_runs')
    .insert({ run_type: 'lead_generation', status: 'started', import_month: leadMonth })
    .select('id')
    .single()

  const runId = runRow?.id
  const startedAt = Date.now()

  try {
    console.log(`🔍  Generating leads for ${leadMonth}...`)
    const result = await generateLeadsForAllUsers(leadMonth)

    // Send notification emails
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('subscription_status', ['active', 'trialing'])

    let emailsSent = 0
    for (const profile of profiles ?? []) {
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('lead_month', leadMonth)

      if ((count ?? 0) === 0) continue

      try {
        await sendLeadsReadyEmail({
          to: profile.email as string,
          name: profile.full_name as string,
          leadCount: count ?? 0,
          monthKey: leadMonth,
          hitMaxRadius: false,
          radiusUsed: 10,
        })
        emailsSent++
      } catch (e) {
        console.error(`Failed to send email to ${profile.email}:`, e)
      }
    }

    await supabase
      .from('pipeline_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startedAt) / 1000),
        users_processed: result.usersProcessed,
        leads_generated: result.totalLeads,
        emails_sent: emailsSent,
        users_at_max_radius: result.usersAtMaxRadius,
        error_message: result.errors.length > 0 ? result.errors.join('\n') : null,
      })
      .eq('id', runId)

    console.log(`✅  Lead generation complete:`, { ...result, emailsSent })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    await supabase
      .from('pipeline_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startedAt) / 1000),
        error_message: errorMessage,
      })
      .eq('id', runId)

    console.error('❌  Lead generation failed:', errorMessage)
    process.exit(1)
  }
}

main()
