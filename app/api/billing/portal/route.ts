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
    return NextResponse.json({ error: 'There’s no billing account to open yet. Subscribe first.' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL is not set')
    return NextResponse.json({ error: 'We couldn’t open billing. Try again in a minute.' }, { status: 500 })
  }
  try {
    const portalUrl = await createPortalSession(
      profile.stripe_customer_id as string,
      appUrl
    )
    return NextResponse.json({ url: portalUrl })
  } catch (err) {
    console.error('Billing portal error:', err)
    return NextResponse.json({ error: 'We couldn’t open billing. Try again in a minute.' }, { status: 500 })
  }
}
