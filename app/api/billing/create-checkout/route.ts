import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateStripeCustomer, createCheckoutSession } from '@/lib/stripe/billing'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

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
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      profile.email as string ?? user.email!,
      profile.full_name as string ?? 'Housepost User'
    )

    const checkoutUrl = await createCheckoutSession(customerId, user.id, appUrl)
    return NextResponse.json({ url: checkoutUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    console.error('Checkout error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
