import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, billPendingOverage } from '@/lib/stripe/billing'
import { sendPostcard, buildRecipientContact, generateFrontHtml, generateBackHtml } from '@/lib/postcards/postgrid'
import { currentMonthKey, formatDate } from '@/lib/utils/date'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { INCLUDED_POSTCARDS_PER_MONTH, POSTCARD_OVERAGE_PENCE } from '@/types/profile'

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
  const { overage } = calculatePostcardCost(leads.length, used)

  if (overage > 0 && !profile.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 403 })
  }

  // Dispatch postcards via PostGrid and insert job records
  const adminSupabase = createAdminClient()
  const dispatched: { leadId: string; jobId: string; isOverage: boolean }[] = []
  const failed: string[] = []
  const failReasons: string[] = []
  // Counts cards that actually went out this request, so the included/overage
  // split is based on real dispatches rather than the original loop index — a
  // lead that loses the claim race must not push another lead into overage.
  let dispatchedSoFar = 0

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    let jobId: string | null = null

    try {
      // 1. Create a pending job row first so we have an id to claim the lead
      //    with. The included/overage flag is set later, once the card actually
      //    dispatches (a pending row is never billed).
      const { data: jobRow, error: jobErr } = await adminSupabase.from('postcard_jobs').insert({
        user_id: user.id,
        lead_id: lead.id,
        lead_month: lead.lead_month,
        recipient_address_line: lead.address_line,
        recipient_postcode: lead.postcode,
        was_included_in_subscription: true,
        charge_amount_pence: 0,
        status: 'pending',
      }).select('id').single()
      if (jobErr || !jobRow) {
        throw new Error(jobErr?.message ?? 'Could not create postcard job')
      }
      jobId = jobRow.id as string

      // 2. Atomically claim the lead. The conditional UPDATE only succeeds if the
      //    lead isn't already linked to a job, so a concurrent double-submit
      //    can't both win — the loser gets zero rows back and skips.
      const { data: claimed, error: claimErr } = await adminSupabase
        .from('leads')
        .update({ postcard_job_id: jobId, selected_for_dispatch: true })
        .eq('id', lead.id)
        .is('postcard_job_id', null)
        .select('id')
      if (claimErr) throw new Error(claimErr.message)
      if (!claimed || claimed.length === 0) {
        // Lost the race — another request already claimed this lead. Cancel our
        // pending job and move on without sending, counting, or billing.
        await adminSupabase.from('postcard_jobs').update({ status: 'cancelled' }).eq('id', jobId)
        continue
      }

      // 3. We own the lead — print and post. The idempotency key is deterministic
      //    per (user, lead, batch), so even a retry that somehow got this far
      //    can't make PostGrid produce a second physical card.
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

      const idempotencyKey = createHash('sha256')
        .update(`postcard:${user.id}:${lead.id}:${lead.lead_month}`)
        .digest('hex')
        .slice(0, 40)

      const { postcardId, status } = await sendPostcard(recipient, frontHtml, backHtml, '6x4', idempotencyKey)

      // Only now that the card is actually going out do we decide whether it's
      // an included or an overage card, based on how many have dispatched so far.
      const isIncluded = used + dispatchedSoFar < INCLUDED_POSTCARDS_PER_MONTH
      dispatchedSoFar++

      await adminSupabase.from('postcard_jobs').update({
        postgrid_letter_id: postcardId,
        postgrid_status: status,
        was_included_in_subscription: isIncluded,
        charge_amount_pence: isIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
        status: 'dispatched',
        dispatched_at: new Date().toISOString(),
      }).eq('id', jobId)

      dispatched.push({ leadId: lead.id as string, jobId, isOverage: !isIncluded })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`PostGrid dispatch failed for lead ${lead.id}:`, msg)
      // Release the lead and mark the pending job failed so the lead becomes
      // eligible to retry rather than being stuck "dispatched".
      if (jobId) {
        await adminSupabase.from('postcard_jobs').update({ status: 'failed' }).eq('id', jobId)
        await adminSupabase.from('leads').update({ postcard_job_id: null }).eq('id', lead.id)
      }
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

  const overageCount = dispatched.filter((d) => d.isOverage).length

  // Bill any unbilled overage for this user — the cards just dispatched plus any
  // left pending by an earlier failed attempt. Per-job idempotency keeps this
  // safe to retry; if Stripe is momentarily down the cards stay pending and the
  // next dispatch or resend sweeps them up, so there's nothing to reconcile by
  // hand.
  let overageBilled = 0
  if (profile.stripe_customer_id) {
    try {
      overageBilled = await billPendingOverage(user.id, profile.stripe_customer_id as string)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Overage billing sweep failed for user ${user.id} (will retry on next activity):`, msg)
    }
  }

  // Increment the usage counter atomically. Falls back to read-modify-write if
  // the increment_postcards_used function hasn't been applied to the DB yet.
  if (dispatched.length > 0) {
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
  }

  return NextResponse.json({
    success: true,
    dispatched: dispatched.length,
    failed: failed.length,
    included: Math.max(0, dispatched.length - overageCount),
    overage: overageCount,
    overageCostPence: overageCount * POSTCARD_OVERAGE_PENCE,
    overageBilled,
  })
}
