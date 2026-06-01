import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, reportOverageUsage } from '@/lib/stripe/billing'
import { sendPostcard, buildRecipientContact, generateFrontHtml, generateBackHtml } from '@/lib/postcards/postgrid'
import { sendAdminAlert } from '@/lib/email/resend'
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
  const { included } = calculatePostcardCost(1, used)
  const isIncluded = included > 0

  if (!isIncluded && !profile.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  // Dispatch first — we only bill once the postcard has actually gone out.
  let newJobId: string | null = null
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

    const { data: jobData } = await adminSupabase.from('postcard_jobs').insert({
      user_id: user.id,
      lead_id: job.lead_id,
      lead_month: currentMonthKey(),
      postgrid_letter_id: postcardId,
      postgrid_status: status,
      recipient_address_line: job.recipient_address_line,
      recipient_postcode: job.recipient_postcode,
      stripe_payment_intent_id: null, // set after billing, below
      was_included_in_subscription: isIncluded,
      charge_amount_pence: isIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
      status: 'dispatched',
      dispatched_at: new Date().toISOString(),
    }).select('id').single()

    newJobId = jobData?.id ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dispatch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Bill the overage (if any) after a successful dispatch, with a deterministic
  // idempotency key so a double-submit can't charge twice.
  let stripeUsageRecordId: string | null = null
  if (!isIncluded && profile.stripe_customer_id) {
    const idempotencyKey = createHash('sha256')
      .update(`${user.id}:${currentMonthKey()}:resend:${jobId}`)
      .digest('hex')
      .slice(0, 40)
    try {
      stripeUsageRecordId = await reportOverageUsage(
        profile.stripe_customer_id as string,
        1,
        idempotencyKey
      )
      if (newJobId) {
        await adminSupabase
          .from('postcard_jobs')
          .update({ stripe_payment_intent_id: stripeUsageRecordId })
          .eq('id', newJobId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Resend overage billing failed after dispatch:', msg)
      try {
        await sendAdminAlert(
          `[Housepost] Resend overage billing failed — user ${user.id}`,
          `<p>A re-sent postcard dispatched for user <strong>${user.id}</strong> but the Stripe meter event failed.</p><pre>${msg}</pre><p>Please reconcile manually.</p>`
        )
      } catch { /* don't mask the original error */ }
    }
  }

  // Atomic counter increment, with read-modify-write fallback.
  const { error: incErr } = await adminSupabase.rpc('increment_postcards_used', {
    p_user_id: user.id,
    p_amount: 1,
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
        postcards_used_this_period: ((fresh?.postcards_used_this_period as number) ?? used) + 1,
      })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true, stripeUsageRecordId })
}
