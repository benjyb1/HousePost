import { NextResponse } from 'next/server'
import { isScheduledRunDay, toMonthKey } from '@/lib/cron/schedule'
import { generateLeadsForAllUsers } from '@/lib/leads/generator'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLeadsReadyEmail } from '@/lib/email/resend'

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
  const leadMonth = toMonthKey(now)

  if (!isScheduledRunDay(22, now)) {
    return NextResponse.json({
      skipped: true,
      reason: 'Not the scheduled run day',
      today: now.toISOString().slice(0, 10),
    })
  }

  const supabase = createAdminClient()

  // Prevent double-execution
  const { data: existingRun } = await supabase
    .from('pipeline_runs')
    .select('id')
    .eq('run_type', 'lead_generation')
    .eq('import_month', leadMonth)
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle()

  if (existingRun) {
    return NextResponse.json({ skipped: true, reason: 'Already run this month', leadMonth })
  }

  const { data: runRow } = await supabase
    .from('pipeline_runs')
    .insert({
      run_type: 'lead_generation',
      status: 'started',
      import_month: leadMonth,
    })
    .select('id')
    .single()

  const runId = runRow?.id
  const startedAt = Date.now()

  try {
    // Check that the import ran first
    const { data: importRun } = await supabase
      .from('pipeline_runs')
      .select('id')
      .eq('run_type', 'land_registry_import')
      .eq('import_month', leadMonth)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle()

    if (!importRun) {
      return NextResponse.json(
        { error: 'Land Registry import has not completed for this month yet' },
        { status: 409 }
      )
    }

    const result = await generateLeadsForAllUsers(leadMonth)

    // Send notification emails to each user
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

      // Check if they hit max radius
      const userResult = result // simplified — for per-user tracking you'd store per-user results
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
        error_message:
          result.errors.length > 0 ? result.errors.join('\n') : null,
      })
      .eq('id', runId)

    return NextResponse.json({ success: true, leadMonth, ...result, emailsSent })
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

    console.error('Lead generation failed:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
