import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, billPendingOverage } from '@/lib/stripe/billing'
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
  const { included } = calculatePostcardCost(1, used)
  const isIncluded = included > 0

  if (!isIncluded && !profile.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  // Deterministic idempotency key — re-sending the same job within the same
  // billing month dedupes at PostGrid, so a double-click can't post two cards.
  const idempotencyKey = createHash('sha256')
    .update(`resend:${user.id}:${jobId}:${currentMonthKey()}`)
    .digest('hex')
    .slice(0, 40)

  // Dispatch first — we only bill once the postcard has actually gone out.
  let postcardId = ''
  let status = ''
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

    ;({ postcardId, status } = await sendPostcard(recipient, frontHtml, backHtml, '6x4', idempotencyKey))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dispatch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // If PostGrid returned a letter we've already recorded (an idempotent replay
  // of a double-click), don't create a second job or bill again.
  const { data: existingJob } = await adminSupabase
    .from('postcard_jobs')
    .select('id')
    .eq('postgrid_letter_id', postcardId)
    .maybeSingle()
  if (existingJob) {
    return NextResponse.json({ success: true, deduped: true })
  }

  // Record the new card. lead_month tracks the original lead's batch so it lines
  // up with the dashboard's per-batch counts. dispatch_idempotency_key carries a
  // UNIQUE partial index, so a truly concurrent double-click (which both passed
  // the check above and got the same PostGrid letter) fails the second insert —
  // we treat that as a dedup rather than billing the card twice.
  const { data: jobData, error: insertErr } = await adminSupabase.from('postcard_jobs').insert({
    user_id: user.id,
    lead_id: job.lead_id,
    lead_month: job.lead_month,
    postgrid_letter_id: postcardId,
    postgrid_status: status,
    recipient_address_line: job.recipient_address_line,
    recipient_postcode: job.recipient_postcode,
    was_included_in_subscription: isIncluded,
    charge_amount_pence: isIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
    status: 'dispatched',
    dispatched_at: new Date().toISOString(),
    dispatch_idempotency_key: idempotencyKey,
  }).select('id').single()

  if (insertErr || !jobData) {
    // Most likely the unique idempotency-key guard rejected a concurrent
    // duplicate — the card already went out under the other request.
    return NextResponse.json({ success: true, deduped: true })
  }

  // Bill any unbilled overage (this card plus anything left pending earlier).
  // Idempotent and self-healing — nothing to reconcile by hand.
  let overageBilled = 0
  if (profile.stripe_customer_id) {
    try {
      overageBilled = await billPendingOverage(user.id, profile.stripe_customer_id as string)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Resend overage billing sweep failed for user ${user.id} (will retry on next activity):`, msg)
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

  return NextResponse.json({ success: true, overageBilled })
}
