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
 * The boss's Stripe product includes a built-in £1/postcard metered component.
 * Uses Stripe Billing Meters (v2 API) to report usage events.
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
