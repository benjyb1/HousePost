import Stripe from 'stripe'
import { getStripe } from './client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function constructStripeEvent(
  rawBody: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

/**
 * Map Stripe subscription status strings to our profile status.
 * Stripe and our DB use the same values, so this is a passthrough,
 * but kept explicit for safety.
 */
function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
  return stripeStatus
}

type AdminClient = ReturnType<typeof createAdminClient>

export type ProfileMatch = {
  userId: string
  matchedBy: 'metadata' | 'customer' | 'email'
}

function customerIdOf(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

// Escape LIKE wildcards so an address such as "a_b@x.com" only ever matches
// itself, never "axb@x.com".
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

async function fetchCustomerEmail(customerId: string): Promise<string | null> {
  const customer = await getStripe().customers.retrieve(customerId)
  if (!customer || customer.deleted) return null
  return customer.email ?? null
}

/**
 * Work out which profile a subscription belongs to.
 *
 * A subscription started from our checkout carries metadata.userId. One made
 * by hand in the Stripe dashboard (a tester, or a friendly customer on a
 * coupon) has no metadata, so we fall back to:
 *   1. the profile that already holds this Stripe customer id, then
 *   2. the one profile whose email matches the Stripe customer's email, and
 *      only when that login's email is confirmed.
 * Anything ambiguous matches nothing, so nobody can pick up someone else's
 * subscription. Lookup errors throw, so the route 500s and Stripe retries.
 */
export async function findProfileForSubscription(
  supabase: AdminClient,
  subscription: Stripe.Subscription,
  getCustomerEmail: (customerId: string) => Promise<string | null> = fetchCustomerEmail
): Promise<ProfileMatch | null> {
  const metadataUserId = subscription.metadata?.userId
  if (metadataUserId) return { userId: metadataUserId, matchedBy: 'metadata' }

  const customerId = customerIdOf(subscription)
  if (!customerId) return null

  // stripe_customer_id is UNIQUE, so this is zero or one row.
  const { data: byCustomer, error: customerErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .limit(1)
  if (customerErr) {
    throw new Error(`Profile lookup by customer ${customerId} failed: ${customerErr.message}`)
  }
  if (byCustomer && byCustomer.length === 1) {
    return { userId: byCustomer[0].id as string, matchedBy: 'customer' }
  }

  const email = (await getCustomerEmail(customerId))?.trim().toLowerCase()
  if (!email) return null

  const { data: byEmail, error: emailErr } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', escapeLike(email))
    .limit(2)
  if (emailErr) {
    throw new Error(`Profile lookup by email for customer ${customerId} failed: ${emailErr.message}`)
  }
  const exact = (byEmail ?? []).filter(
    (p) => ((p.email as string | null) ?? '').trim().toLowerCase() === email
  )
  if (exact.length !== 1) return null

  // Only a confirmed login with that same email may claim the subscription.
  const candidateId = exact[0].id as string
  const { data: auth, error: authErr } = await supabase.auth.admin.getUserById(candidateId)
  if (authErr) {
    if (authErr.status === 404) return null
    throw new Error(`Auth lookup for profile ${candidateId} failed: ${authErr.message}`)
  }
  const user = auth?.user
  if (!user?.email_confirmed_at) return null
  if ((user.email ?? '').trim().toLowerCase() !== email) return null

  return { userId: candidateId, matchedBy: 'email' }
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createAdminClient()
  const match = await findProfileForSubscription(supabase, subscription)
  if (!match) {
    console.warn(
      `Subscription ${subscription.id} matched no profile: no userId metadata, no profile with its customer id, and no single confirmed profile with its email`
    )
    return
  }
  const { userId, matchedBy } = match
  if (matchedBy !== 'metadata') {
    console.info(`Subscription ${subscription.id} has no userId metadata; matched profile ${userId} by ${matchedBy}`)
  }

  const { data: current, error: readErr } = await supabase
    .from('profiles')
    .select('stripe_subscription_id, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()
  if (readErr) {
    throw new Error(`Failed to read profile ${userId}: ${readErr.message}`)
  }
  if (!current) {
    console.warn(`Subscription webhook matched no profile for userId ${userId} (subscription ${subscription.id})`)
    return
  }

  // A profile already on a different subscription only moves onto this one if
  // this one is live. Otherwise a stray event from an old or replaced
  // subscription could knock the customer off the one they're paying for.
  const onOther =
    !!current.stripe_subscription_id && current.stripe_subscription_id !== subscription.id
  if (onOther && subscription.status !== 'active' && subscription.status !== 'trialing') {
    console.warn(
      `Ignoring ${subscription.status} subscription ${subscription.id}: profile ${userId} is on ${current.stripe_subscription_id}`
    )
    return
  }

  // In Stripe v20, current_period_end/start moved to items.data[0]
  const firstItem = subscription.items?.data?.[0]
  const periodEnd = firstItem?.current_period_end
  const periodStart = firstItem?.current_period_start

  // Only write the period dates when Stripe actually gave them to us — never
  // blank out a good value because a particular event omitted the field.
  const update: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    subscription_status: mapStatus(subscription.status),
  }
  if (periodEnd) update.subscription_period_end = new Date(periodEnd * 1000).toISOString()
  if (periodStart) update.current_period_start = new Date(periodStart * 1000).toISOString()

  // Matched by email: no profile holds this customer yet, so record it here and
  // the invoice handlers (allowance reset, payment failed) can find it later.
  // A profile that already has a different customer keeps it; we never
  // silently repoint which card gets charged.
  const customerId = customerIdOf(subscription)
  if (matchedBy === 'email' && customerId) {
    if (!current.stripe_customer_id) {
      update.stripe_customer_id = customerId
    } else if (current.stripe_customer_id !== customerId) {
      console.warn(
        `Profile ${userId} is on customer ${current.stripe_customer_id} but subscription ${subscription.id} belongs to ${customerId}; left the profile's customer as it was`
      )
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)

  // Throw on a real DB error so the route 500s and Stripe retries, rather than
  // silently dropping a subscription state change.
  if (error) {
    throw new Error(`Failed to update subscription for user ${userId}: ${error.message}`)
  }
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createAdminClient()
  const match = await findProfileForSubscription(supabase, subscription)
  if (!match) {
    console.warn(`Deleted subscription ${subscription.id} matched no profile`)
    return
  }
  const { userId } = match

  // Only cancel the profile if this is the subscription it's on, or it has none
  // recorded. Deleting an old subscription that was replaced by hand must not
  // cancel the newer one.
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'canceled' })
    .eq('id', userId)
    .or(`stripe_subscription_id.is.null,stripe_subscription_id.eq.${subscription.id}`)

  if (error) {
    throw new Error(`Failed to mark subscription canceled for user ${userId}: ${error.message}`)
  }
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  // Reset postcard allowance on subscription renewal
  if (invoice.billing_reason !== 'subscription_cycle') return

  const supabase = createAdminClient()
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

  if (!customerId) return

  const { error } = await supabase
    .from('profiles')
    .update({ postcards_used_this_period: 0 })
    .eq('stripe_customer_id', customerId)

  if (error) {
    throw new Error(`Failed to reset postcard allowance for customer ${customerId}: ${error.message}`)
  }
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const supabase = createAdminClient()
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

  if (!customerId) return

  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId)

  if (error) {
    throw new Error(`Failed to mark past_due for customer ${customerId}: ${error.message}`)
  }
}
