import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, reportOverageUsage } from '@/lib/stripe/billing'
import { sendPostcard, buildRecipientContact, generateFrontHtml, generateBackHtml } from '@/lib/postcards/postgrid'
import { sendAdminAlert } from '@/lib/email/resend'
import { currentMonthKey, formatDate } from '@/lib/utils/date'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { POSTCARD_OVERAGE_PENCE } from '@/types/profile'

// GET: list postcard jobs for the authenticated user
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? currentMonthKey()

  const { data, error } = await supabase
    .from('postcard_jobs')
    .select('*')
    .eq('user_id', user.id)
    .eq('lead_month', month)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data })
}

// POST: dispatch selected leads as postcards
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { leadIds } = body as { leadIds: string[] }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'No leads selected' }, { status: 400 })
  }

  // Fetch profile for billing and design info
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, postcards_used_this_period, postcard_design_url, postcard_design_back_url, full_name, subscription_status')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!['active', 'trialing'].includes(profile.subscription_status as string)) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
  }

  // Fetch the selected leads. Exclude any that already have a postcard job —
  // this is the guard against a double-submit dispatching (and billing) twice.
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .in('id', leadIds)
    .is('postcard_job_id', null)

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 })
  }
  if (!leads?.length) {
    return NextResponse.json(
      { error: 'No eligible leads — they may already have been sent.' },
      { status: 409 }
    )
  }

  // Work out how many are included vs overage, but DON'T bill yet — we only
  // charge for postcards that actually dispatch (see after the loop).
  const used = profile.postcards_used_this_period as number
  const { included, overage, overageCostPence } = calculatePostcardCost(leads.length, used)

  if (overage > 0 && !profile.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 403 })
  }

  // Dispatch postcards via PostGrid and insert job records
  const adminSupabase = createAdminClient()
  const dispatched: { leadId: string; jobId: string | null; isOverage: boolean }[] = []
  const failed: string[] = []
  const failReasons: string[] = []

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const isIncluded = i < included

    try {
      const propertyLabel = lead.property_type
        ? (PROPERTY_TYPE_LABELS[(lead.property_type as keyof typeof PROPERTY_TYPE_LABELS)] ?? lead.property_type)
        : null

      const frontHtml = generateFrontHtml({
        senderName: profile.full_name as string,
        designUrl: profile.postcard_design_url as string | null,
      })

      const backHtml = generateBackHtml({
        recipientAddress: lead.address_line as string,
        price: lead.price as number | null,
        propertyType: propertyLabel,
        saleDate: lead.date_of_transfer ? formatDate(lead.date_of_transfer as string) : null,
        senderName: profile.full_name as string,
        backDesignUrl: profile.postcard_design_back_url as string | null,
      })

      const recipient = buildRecipientContact(
        lead.address_line as string,
        lead.postcode as string
      )

      const { postcardId, status } = await sendPostcard(recipient, frontHtml, backHtml, '6x4')

      const { data: jobData } = await adminSupabase.from('postcard_jobs').insert({
        user_id: user.id,
        lead_id: lead.id,
        lead_month: lead.lead_month,
        postgrid_letter_id: postcardId,
        postgrid_status: status,
        recipient_address_line: lead.address_line,
        recipient_postcode: lead.postcode,
        stripe_payment_intent_id: null, // set after billing, below
        was_included_in_subscription: isIncluded,
        charge_amount_pence: isIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
        status: 'dispatched',
        dispatched_at: new Date().toISOString(),
      }).select('id').single()

      // Link lead to job so the UI shows "Dispatched"
      await adminSupabase
        .from('leads')
        .update({ postcard_job_id: jobData?.id, selected_for_dispatch: true })
        .eq('id', lead.id)

      dispatched.push({ leadId: lead.id as string, jobId: jobData?.id ?? null, isOverage: !isIncluded })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`PostGrid dispatch failed for lead ${lead.id}:`, msg)
      failed.push(lead.id as string)
      failReasons.push(msg)
    }
  }

  // If everything failed, nothing dispatched and nothing to bill.
  if (dispatched.length === 0 && failed.length > 0) {
    return NextResponse.json({
      error: `All ${failed.length} postcard${failed.length === 1 ? '' : 's'} failed to dispatch`,
      dispatched: 0,
      failed: failed.length,
      reasons: failReasons,
    }, { status: 502 })
  }

  // Bill ONLY for overage postcards that actually dispatched, with a
  // deterministic idempotency key so a retried request can't double-charge.
  const overageJobs = dispatched.filter((d) => d.isOverage)
  let stripeUsageRecordId: string | null = null
  if (overageJobs.length > 0 && profile.stripe_customer_id) {
    const idempotencyKey = createHash('sha256')
      .update(`${user.id}:${currentMonthKey()}:${dispatched.map((d) => d.leadId).sort().join(',')}`)
      .digest('hex')
      .slice(0, 40)
    try {
      stripeUsageRecordId = await reportOverageUsage(
        profile.stripe_customer_id as string,
        overageJobs.length,
        idempotencyKey
      )
      const overageJobIds = overageJobs.map((d) => d.jobId).filter(Boolean) as string[]
      if (overageJobIds.length > 0) {
        await adminSupabase
          .from('postcard_jobs')
          .update({ stripe_payment_intent_id: stripeUsageRecordId })
          .in('id', overageJobIds)
      }
    } catch (err) {
      // Postcards already went out, so don't fail the request — alert instead
      // so the charge can be reconciled manually.
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Overage billing failed after dispatch:', msg)
      try {
        await sendAdminAlert(
          `[Housepost] Overage billing failed — user ${user.id}`,
          `<p>${overageJobs.length} overage postcard(s) dispatched for user <strong>${user.id}</strong> but the Stripe meter event failed.</p><pre>${msg}</pre><p>Please reconcile manually.</p>`
        )
      } catch { /* don't mask the original error */ }
    }
  }

  // Increment the usage counter atomically. Falls back to read-modify-write if
  // the increment_postcards_used function hasn't been applied to the DB yet.
  const { error: incErr } = await adminSupabase.rpc('increment_postcards_used', {
    p_user_id: user.id,
    p_amount: dispatched.length,
  })
  if (incErr) {
    const { data: fresh } = await adminSupabase
      .from('profiles')
      .select('postcards_used_this_period')
      .eq('id', user.id)
      .single()
    await adminSupabase
      .from('profiles')
      .update({
        postcards_used_this_period:
          ((fresh?.postcards_used_this_period as number) ?? used) + dispatched.length,
      })
      .eq('id', user.id)
  }

  return NextResponse.json({
    success: true,
    dispatched: dispatched.length,
    failed: failed.length,
    included,
    overage: overageJobs.length,
    overageCostPence: overageJobs.length * POSTCARD_OVERAGE_PENCE,
    stripeUsageRecordId,
  })
}
