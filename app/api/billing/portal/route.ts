import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPortalSession } from '@/lib/stripe/billing'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  try {
    const portalUrl = await createPortalSession(
      profile.stripe_customer_id as string,
      appUrl
    )
    return NextResponse.json({ url: portalUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to open billing portal'
    console.error('Billing portal error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
