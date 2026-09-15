import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentMonthKey } from '@/lib/utils/date'
import { isAddressSuppressed } from '@/lib/leads/suppression'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const archived = searchParams.get('archived') === 'true'

  let query = supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)

  if (archived) {
    query = query.not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
  } else {
    query = query.is('archived_at', null)
      .order('lead_month', { ascending: false })
      .order('distance_miles', { ascending: true })
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ leads: data })
}

// POST: create a custom lead (manual address)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { addressLine, postcode } = body as { addressLine: string; postcode: string }

  if (!addressLine?.trim() || !postcode?.trim()) {
    return NextResponse.json({ error: 'Address and postcode are required' }, { status: 400 })
  }

  // Do-not-contact screening: a hand-typed custom address must be checked against
  // the suppression list too, otherwise the opt-out is trivially bypassed. Uses
  // the admin client (suppression_list denies all ordinary roles). Fails CLOSED —
  // a transient read error refuses the add rather than letting it through.
  try {
    const suppressed = await isAddressSuppressed(
      createAdminClient(),
      addressLine.trim(),
      postcode.trim()
    )
    if (suppressed) {
      return NextResponse.json(
        { error: 'This address is on our do-not-contact list and can’t be added.' },
        { status: 422 }
      )
    }
  } catch (err) {
    console.error('Suppression screen failed for custom lead:', err)
    return NextResponse.json(
      { error: 'We could not verify the do-not-contact list just now. Please try again shortly.' },
      { status: 503 }
    )
  }

  const leadMonth = currentMonthKey()

  const { data, error } = await supabase.from('leads').insert({
    user_id: user.id,
    address_line: addressLine.trim().toUpperCase(),
    postcode: postcode.trim().toUpperCase(),
    lead_month: leadMonth,
    is_custom: true,
    is_new_build: false,
    selected_for_dispatch: false,
  }).select('*').single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lead: data }, { status: 201 })
}
