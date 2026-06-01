import { NextResponse } from 'next/server'
import { isWithinRunWindow, toMonthKey } from '@/lib/cron/schedule'
import { generateLeadsForAllUsers } from '@/lib/leads/generator'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLeadsReadyEmail, sendAdminAlert } from '@/lib/email/resend'

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

  if (!isWithinRunWindow(22, now)) {
    return NextResponse.json({
      skipped: true,
      reason: 'Outside the run window',
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

      const userResult = result.perUser[profile.id as string]
      try {
        await sendLeadsReadyEmail({
          to: profile.email as string,
          name: profile.full_name as string,
          leadCount: count ?? 0,
          monthKey: leadMonth,
          hitMaxRadius: userResult?.hitMaxRadius ?? false,
          radiusUsed: userResult?.radiusUsed ?? 10,
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

    // A completed run that found nothing (or hit per-user errors) is suspicious.
    if (result.totalLeads === 0 || result.errors.length > 0) {
      try {
        await sendAdminAlert(
          `[Housepost] Lead run needs a look — ${leadMonth}`,
          `<p>Lead generation for <strong>${leadMonth}</strong> completed but looks off.</p>
           <ul>
             <li>Users processed: ${result.usersProcessed}</li>
             <li>Leads generated: <strong>${result.totalLeads}</strong></li>
             <li>Users at max radius: ${result.usersAtMaxRadius}</li>
             <li>Emails sent: ${emailsSent}</li>
           </ul>
           ${result.errors.length > 0 ? `<pre>${result.errors.join('\n')}</pre>` : ''}`
        )
      } catch (e) {
        console.error('Failed to send zero-lead admin alert:', e)
      }
    }

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
