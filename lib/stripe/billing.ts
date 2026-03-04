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
 * Create a Stripe Checkout Session for the £10/month subscription.
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
 * Charge the customer for overage postcards (£1 each) as a one-off payment.
 * Uses idempotency key to allow safe retries.
 */
export async function chargeOveragePostcards(
  customerId: string,
  quantity: number,
  idempotencyKey: string
): Promise<string> {
  const stripe = getStripe()

  const paymentIntent = await stripe.paymentIntents.create(
    {
      customer: customerId,
      amount: quantity * POSTCARD_OVERAGE_PENCE,
      currency: 'gbp',
      confirm: true,
      off_session: true,
      description: `Housepost: ${quantity} additional postcard${quantity === 1 ? '' : 's'}`,
    },
    { idempotencyKey }
  )

  if (paymentIntent.status !== 'succeeded') {
    throw new Error(
      `Overage payment failed with status: ${paymentIntent.status}`
    )
  }

  return paymentIntent.id
}
