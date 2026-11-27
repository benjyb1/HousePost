import { NextResponse } from 'next/server'
import { isWithinRunWindow, toMonthKey } from '@/lib/cron/schedule'
import { generateLeadsForAllUsers } from '@/lib/leads/generator'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminAlert } from '@/lib/email/resend'
import { sendLeadDropEmails } from '@/lib/leads/drop-emails'
import { verifyCronRequest } from '@/lib/cron/auth'

export const maxDuration = 60

// Another run that started this recently is taken to be still going (the
// GitHub script can take up to 30 minutes). An older 'started' row is a run
// that died, and doesn't block a new one.
const RUN_IN_PROGRESS_MINUTES = 120
// Stop starting new email batches this far in, so the function isn't killed
// mid-send. Anyone not reached is emailed by the next run.
const EMAIL_DEADLINE_MS = 45_000

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const leadMonth = toMonthKey(now)

  if (!isWithinRunWindow(6, now)) {
    return NextResponse.json({
      skipped: true,
      reason: 'Outside the run window',
      today: now.toISOString().slice(0, 10),
    })
  }

  const supabase = createAdminClient()

  // Prevent double-execution: a finished run this month, or one still going.
  const { data: existingRun, error: existingErr } = await supabase
    .from('pipeline_runs')
    .select('id, status, started_at')
    .eq('run_type', 'lead_generation')
    .eq('import_month', leadMonth)
    .in('status', ['completed', 'started'])
    .order('started_at', { ascending: false })
    .limit(5)
  if (existingErr) {
    console.error('Lead generation: could not check earlier runs:', existingErr)
    return NextResponse.json({ error: 'Could not check earlier runs' }, { status: 500 })
  }
  if ((existingRun ?? []).some((r) => r.status === 'completed')) {
    return NextResponse.json({ skipped: true, reason: 'Already run this month', leadMonth })
  }
  const busySince = Date.now() - RUN_IN_PROGRESS_MINUTES * 60_000
  if ((existingRun ?? []).some((r) => r.status === 'started' && Date.parse(r.started_at as string) > busySince)) {
    return NextResponse.json({ skipped: true, reason: 'Another run is in progress', leadMonth })
  }

  // The import must have finished first. Checked before the run is recorded,
  // so waiting for it doesn't leave a 'started' row behind.
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
    const result = await generateLeadsForAllUsers(leadMonth)

    // "Your homes are ready" emails and notifications, once per user per month.
    const emails = await sendLeadDropEmails(supabase, leadMonth, result.perUser, {
      notify: true,
      deadline: startedAt + EMAIL_DEADLINE_MS,
    })
    const emailsSent = emails.sent

    if (emails.deferred > 0) {
      // Out of time. Leave the run open to the next invocation, which skips
      // everyone already emailed.
      await supabase
        .from('pipeline_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_seconds: Math.round((Date.now() - startedAt) / 1000),
          users_processed: result.usersProcessed,
          leads_generated: result.totalLeads,
          emails_sent: emailsSent,
          error_message: `Stopped early: ${emails.deferred} subscriber(s) still to email. The next run carries on without re-emailing anyone.`,
        })
        .eq('id', runId)
      return NextResponse.json({ success: false, partial: true, leadMonth, ...result, ...emails }, { status: 202 })
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
          `[Housepost] Lead run needs a look – ${leadMonth}`,
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
