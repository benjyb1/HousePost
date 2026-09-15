import Stripe from 'stripe'
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
 * Resolve the customer's saved card to charge off-session. Prefers the
 * invoice_settings default payment method, falling back to their most recent
 * saved card. Returns null when the customer has no usable card on file.
 */
async function getDefaultCardPaymentMethod(
  customerId: string
): Promise<string | null> {
  const stripe = getStripe()

  const customer = await stripe.customers.retrieve(customerId)
  // A deleted customer comes back as { deleted: true } with no fields.
  if (!customer || customer.deleted) return null

  const defaultPm = customer.invoice_settings?.default_payment_method
  if (defaultPm) {
    return typeof defaultPm === 'string' ? defaultPm : defaultPm.id
  }

  // No explicit default — fall back to the newest saved card.
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  })
  return methods.data[0]?.id ?? null
}

/**
 * Charge the customer's SAVED card off-session for a batch of paid postcards
 * (feature 8.6). Used to take payment UP FRONT, before an order is held, so a
 * decline aborts the send and nothing is dispatched.
 *
 * Throws a clear, user-facing error when there is no saved card or the card is
 * declined. `idempotencyKey` must be stable for the logical send (we key it on
 * the batch id) so a retried confirm never double-charges.
 *
 * Returns the succeeded PaymentIntent id, which is recorded on the order for a
 * later refund if the user cancels within the cool-off window.
 */
export async function chargePostcardBatch(params: {
  customerId: string
  amountPence: number
  idempotencyKey: string
  metadata?: Record<string, string>
}): Promise<{ paymentIntentId: string }> {
  const stripe = getStripe()

  if (params.amountPence <= 0) {
    throw new Error('Refusing to charge a non-positive amount')
  }

  const paymentMethod = await getDefaultCardPaymentMethod(params.customerId)
  if (!paymentMethod) {
    throw new Error(
      'No saved card on file. Add a payment card in Billing before sending paid postcards.'
    )
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: params.amountPence,
        currency: 'gbp',
        customer: params.customerId,
        payment_method: paymentMethod,
        // Off-session: the user has confirmed the send but there is no card-entry
        // step, so Stripe charges the stored card immediately.
        off_session: true,
        confirm: true,
        metadata: params.metadata,
      },
      { idempotencyKey: params.idempotencyKey }
    )

    if (intent.status !== 'succeeded') {
      // e.g. requires_action (3-D Secure) — off-session we cannot prompt for it,
      // so treat anything short of success as a failed charge and abort the send.
      throw new Error(
        `Card charge did not complete (status: ${intent.status}). Please update your card in Billing and try again.`
      )
    }

    return { paymentIntentId: intent.id }
  } catch (err) {
    // Stripe surfaces off-session declines as a card error carrying the failed
    // PaymentIntent. Bubble up a clean message; the caller aborts the send.
    if (err instanceof Stripe.errors.StripeError) {
      const declineMessage =
        err.code === 'authentication_required'
          ? 'Your card needs authentication that we cannot complete for an automatic charge. Please contact support or update your card.'
          : err.message || 'Your card was declined.'
      throw new Error(declineMessage)
    }
    throw err
  }
}

/** One-off "design my postcard for me" service fee: £75 (feature 10.5). */
export const CUSTOM_DESIGN_FEE_PENCE = 7500

/**
 * Charge the customer's SAVED card off-session for the one-off £75 custom-design
 * service fee (feature 10.5). Mirrors `chargePostcardBatch`: the user has already
 * confirmed by submitting their brief, so there is no card-entry step and we
 * charge the stored card immediately.
 *
 * Throws a clear, user-facing error when there is no saved card or the card is
 * declined, so the caller can abort and record NOTHING as a paid request.
 *
 * `idempotencyKey` should be stable for the logical request (we key it on the
 * design-request id) so a retried submit never double-charges. Returns the
 * succeeded PaymentIntent id to store on the request row.
 */
export async function chargeCustomDesignFee(params: {
  customerId: string
  idempotencyKey: string
  metadata?: Record<string, string>
}): Promise<{ paymentIntentId: string }> {
  const stripe = getStripe()

  const paymentMethod = await getDefaultCardPaymentMethod(params.customerId)
  if (!paymentMethod) {
    throw new Error(
      'No saved card on file. Add a payment card in Billing before requesting a custom design.'
    )
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: CUSTOM_DESIGN_FEE_PENCE,
        currency: 'gbp',
        customer: params.customerId,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        metadata: params.metadata,
      },
      { idempotencyKey: params.idempotencyKey }
    )

    if (intent.status !== 'succeeded') {
      throw new Error(
        `Card charge did not complete (status: ${intent.status}). Please update your card in Billing and try again.`
      )
    }

    return { paymentIntentId: intent.id }
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      const declineMessage =
        err.code === 'authentication_required'
          ? 'Your card needs authentication that we cannot complete for an automatic charge. Please contact support or update your card.'
          : err.message || 'Your card was declined.'
      throw new Error(declineMessage)
    }
    throw err
  }
}

/**
 * Refund a postcard charge (feature 6.4) when a held order is cancelled inside
 * the cool-off window. `amountPence` lets us refund only the cards actually
 * cancelled when a batch is partially released. `idempotencyKey` (keyed on the
 * batch) makes a double-clicked cancel safe — Stripe returns the same refund
 * rather than issuing a second one.
 */
export async function refundPostcardCharge(params: {
  paymentIntentId: string
  amountPence: number
  idempotencyKey: string
}): Promise<{ refundId: string }> {
  const stripe = getStripe()

  if (params.amountPence <= 0) {
    // Nothing payable was cancelled (all cancelled cards were free allowance).
    return { refundId: '' }
  }

  const refund = await stripe.refunds.create(
    {
      payment_intent: params.paymentIntentId,
      amount: params.amountPence,
    },
    { idempotencyKey: params.idempotencyKey }
  )

  return { refundId: refund.id }
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
