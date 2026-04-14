import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, reportOverageUsage } from '@/lib/stripe/billing'
import { sendPostcard, buildRecipientContact, generateFrontHtml, generateBackHtml } from '@/lib/postcards/postgrid'
import { currentMonthKey } from '@/lib/utils/date'
import { POSTCARD_OVERAGE_PENCE } from '@/types/profile'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await request.json() as { jobId: string }
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  // Fetch the original job
  const { data: job, error: jobError } = await supabase
    .from('postcard_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Fetch profile
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

  const used = profile.postcards_used_this_period as number
  const { included, overage, overageCostPence } = calculatePostcardCost(1, used)

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
        `${user.id}-${currentMonthKey()}-resend-${Date.now()}`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Usage reporting failed'
      return NextResponse.json({ error: `Billing error: ${msg}` }, { status: 402 })
    }
  }

  const adminSupabase = createAdminClient()

  try {
    const recipient = buildRecipientContact(
      job.recipient_address_line as string,
      job.recipient_postcode as string,
    )

    const frontHtml = generateFrontHtml({
      senderName: profile.full_name as string,
      designUrl: profile.postcard_design_url as string | null,
    })

    const backHtml = generateBackHtml({
      recipientAddress: job.recipient_address_line as string,
      price: null,
      propertyType: null,
      saleDate: null,
      senderName: profile.full_name as string,
      backDesignUrl: profile.postcard_design_back_url as string | null,
    })

    const { postcardId, status } = await sendPostcard(recipient, frontHtml, backHtml, '6x4')

    const isIncluded = included > 0

    await adminSupabase.from('postcard_jobs').insert({
      user_id: user.id,
      lead_id: job.lead_id,
      lead_month: currentMonthKey(),
      postgrid_letter_id: postcardId,
      postgrid_status: status,
      recipient_address_line: job.recipient_address_line,
      recipient_postcode: job.recipient_postcode,
      stripe_payment_intent_id: isIncluded ? null : stripeUsageRecordId,
      was_included_in_subscription: isIncluded,
      charge_amount_pence: isIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
      status: 'dispatched',
      dispatched_at: new Date().toISOString(),
    })

    await adminSupabase
      .from('profiles')
      .update({ postcards_used_this_period: used + 1 })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dispatch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
