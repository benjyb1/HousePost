import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateStripeCustomer, createCheckoutSession, findLiveSubscription } from '@/lib/stripe/billing'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'We couldn’t find your account. Please sign in again.' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL is not set')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (!process.env.STRIPE_PRICE_ID) {
    console.error('STRIPE_PRICE_ID is not set')
    return NextResponse.json({ error: 'Stripe is not configured yet' }, { status: 500 })
  }

  try {
    // Already subscribed (including overdue, unpaid or paused)? Then the
    // answer is the billing portal, never a second subscription.
    if (profile.stripe_customer_id) {
      const existing = await findLiveSubscription(profile.stripe_customer_id as string)
      if (existing) {
        return NextResponse.json(
          { error: 'You already have a subscription. Manage it in billing instead.', manage: true },
          { status: 409 }
        )
      }
    }

    const customerId = await getOrCreateStripeCustomer(
      user.id,
      (profile.email as string | null) ?? user.email!,
      (profile.full_name as string | null) ?? 'Housepost User'
    )

    // The customer may have been made just now by another tab that went on to subscribe.
    if (customerId !== profile.stripe_customer_id && (await findLiveSubscription(customerId))) {
      return NextResponse.json(
        { error: 'You already have a subscription. Manage it in billing instead.', manage: true },
        { status: 409 }
      )
    }

    const checkoutUrl = await createCheckoutSession(customerId, user.id, appUrl)
    return NextResponse.json({ url: checkoutUrl })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'We couldn’t start checkout. Try again in a minute.' }, { status: 500 })
  }
}
