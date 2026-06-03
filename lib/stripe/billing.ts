import { createHash } from 'crypto'
import { getStripe } from './client'
import { createAdminClient } from '@/lib/supabase/admin'
import { INCLUDED_POSTCARDS_PER_MONTH, POSTCARD_OVERAGE_PENCE } from '@/types/profile'

/**
 * Get or create a Stripe Customer for the given user.
 * Stores the customer ID in the profiles table.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const supabase = createAdminClient()
  const stripe = getStripe()

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string
  }

  const customer = await stripe.customers.create({ email, name })

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  return customer.id
}

/**
 * Create a Stripe Checkout Session for the £15/month subscription.
 */
export async function createCheckoutSession(
  customerId: string,
  userId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${returnUrl}/billing?checkout=success`,
    cancel_url: `${returnUrl}/billing?checkout=cancelled`,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
    },
  })

  return session.url!
}

/**
 * Create a Stripe Customer Portal session so users can manage their subscription.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${returnUrl}/billing`,
  })

  return session.url
}

/**
 * Calculate the cost breakdown for a postcard dispatch.
 */
export function calculatePostcardCost(
  postcardCount: number,
  usedThisPeriod: number
): {
  included: number
  overage: number
  overageCostPence: number
} {
  const remaining = Math.max(0, INCLUDED_POSTCARDS_PER_MONTH - usedThisPeriod)
  const included = Math.min(postcardCount, remaining)
  const overage = Math.max(0, postcardCount - included)
  return {
    included,
    overage,
    overageCostPence: overage * POSTCARD_OVERAGE_PENCE,
  }
}

/**
 * Report overage postcard usage to Stripe's metered billing.
 * Overage postcards are charged at £1.50 each (POSTCARD_OVERAGE_PENCE); the
 * Stripe meter's per-unit price must match. Uses Stripe Billing Meters (v2 API).
 *
 * Requires STRIPE_METER_EVENT_NAME env var (the event_name from the Stripe Billing Meter).
 */
export async function reportOverageUsage(
  customerId: string,
  quantity: number,
  idempotencyKey: string
): Promise<string> {
  const stripe = getStripe()

  const eventName = process.env.STRIPE_METER_EVENT_NAME
  if (!eventName) {
    throw new Error(
      'STRIPE_METER_EVENT_NAME is not set. Ask your Stripe admin for the meter event name.'
    )
  }

  // Report one meter event per overage postcard batch.
  // The meter's value_settings.event_payload_key defaults to "value".
  const meterEvent = await stripe.billing.meterEvents.create(
    {
      event_name: eventName,
      payload: {
        stripe_customer_id: customerId,
        value: String(quantity),
      },
      identifier: idempotencyKey,
      timestamp: Math.floor(Date.now() / 1000),
    }
  )

  return meterEvent.identifier ?? idempotencyKey
}

/**
 * Bill every overage postcard for this user that hasn't been billed yet, and
 * mark each one billed. An "unbilled overage" is a dispatched job with
 * was_included_in_subscription = false and no stripe_payment_intent_id.
 *
 * Each card is metered as one unit with a per-job idempotency key, so this is
 * safe to call repeatedly: Stripe dedupes by identifier, and any card already
 * carrying a payment id is skipped. That makes billing self-healing — if a
 * meter call failed earlier (Stripe blip, missing config), the next dispatch or
 * resend sweeps it up automatically. No manual reconciliation.
 *
 * Returns the number of cards newly billed. Throws if a meter call fails, so
 * the caller can decide whether to surface it; the unbilled cards simply stay
 * pending for the next sweep.
 */
export async function billPendingOverage(
  userId: string,
  customerId: string
): Promise<number> {
  const supabase = createAdminClient()

  const { data: pending, error } = await supabase
    .from('postcard_jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'dispatched')
    .eq('was_included_in_subscription', false)
    .is('stripe_payment_intent_id', null)

  if (error) {
    throw new Error(`Failed to read pending overage for user ${userId}: ${error.message}`)
  }
  if (!pending || pending.length === 0) return 0

  let billed = 0
  for (const job of pending) {
    const jobId = job.id as string
    const idempotencyKey = createHash('sha256')
      .update(`overage:${jobId}`)
      .digest('hex')
      .slice(0, 40)

    const recordId = await reportOverageUsage(customerId, 1, idempotencyKey)

    await supabase
      .from('postcard_jobs')
      .update({ stripe_payment_intent_id: recordId })
      .eq('id', jobId)

    billed++
  }
  return billed
}
