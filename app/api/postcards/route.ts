import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, reportOverageUsage } from '@/lib/stripe/billing'
import { sendPostcard, buildRecipientContact, generateFrontHtml, generateBackHtml } from '@/lib/postcards/postgrid'
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

  // Fetch the selected leads
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .in('id', leadIds)

  if (leadsError || !leads?.length) {
    return NextResponse.json({ error: 'Leads not found' }, { status: 404 })
  }

  // Calculate billing
  const used = profile.postcards_used_this_period as number
  const { included, overage, overageCostPence } = calculatePostcardCost(leads.length, used)

  // Report overage usage to Stripe's metered billing (£1.50/postcard charge)
  let stripeUsageRecordId: string | null = null
  if (overage > 0) {
    const customerId = profile.stripe_customer_id as string | null
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 403 })
    }
    try {
      stripeUsageRecordId = await reportOverageUsage(
        customerId,
        overage,
        `${user.id}-${currentMonthKey()}-overage-${Date.now()}` // idempotency key
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Usage reporting failed'
      return NextResponse.json({ error: `Billing error: ${msg}` }, { status: 402 })
    }
  }

  // Dispatch postcards via PostGrid and insert job records
  const adminSupabase = createAdminClient()
  const dispatched: string[] = []
  const failed: string[] = []

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const isIncluded = i < included

    try {
      const propertyLabel =
        PROPERTY_TYPE_LABELS[(lead.property_type as keyof typeof PROPERTY_TYPE_LABELS)] ??
        lead.property_type

      const frontHtml = generateFrontHtml({
        senderName: profile.full_name as string,
        designUrl: profile.postcard_design_url as string | null,
      })

      const backHtml = generateBackHtml({
        recipientAddress: lead.address_line as string,
        price: lead.price as number,
        propertyType: propertyLabel,
        saleDate: formatDate(lead.date_of_transfer as string),
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
        stripe_payment_intent_id: isIncluded ? null : stripeUsageRecordId,
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

      dispatched.push(lead.id as string)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`PostGrid dispatch failed for lead ${lead.id}:`, msg)
      failed.push(lead.id as string)
    }
  }

  // Update postcards_used_this_period
  await adminSupabase
    .from('profiles')
    .update({ postcards_used_this_period: used + dispatched.length })
    .eq('id', user.id)

  if (dispatched.length === 0 && failed.length > 0) {
    return NextResponse.json({
      error: `All ${failed.length} postcard${failed.length === 1 ? '' : 's'} failed to dispatch`,
      dispatched: 0,
      failed: failed.length,
    }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    dispatched: dispatched.length,
    failed: failed.length,
    included,
    overage,
    overageCostPence,
    stripeUsageRecordId,
  })
}
