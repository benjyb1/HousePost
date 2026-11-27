import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { latestBatchMonth } from '@/lib/leads/batch-month'
import { isAddressSuppressed } from '@/lib/leads/suppression'
import { hasFullAccess } from '@/lib/leads/preview'
import { loadPreviewIds, prefsFromProfile } from '@/lib/leads/preview-server'

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

  const [{ data, error }, { data: profile, error: profileError }] = await Promise.all([
    query,
    supabase
      .from('profiles')
      .select('subscription_status, search_radius_miles, min_price, max_price, property_types')
      .eq('id', user.id)
      .single(),
  ])

  if (error || profileError) {
    console.error('[GET /api/leads]', error ?? profileError)
    return NextResponse.json({ error: 'Could not load your homes just now. Please try again.' }, { status: 500 })
  }

  if (hasFullAccess(profile?.subscription_status as string | null)) {
    return NextResponse.json({ leads: data })
  }

  // Before subscribing: only the five open homes (see lib/leads/preview), homes
  // added by hand, and anything already sent, which the user has seen.
  let open: Set<string>
  try {
    open = await loadPreviewIds(createAdminClient(), user.id, prefsFromProfile(profile))
  } catch (err) {
    console.error('[GET /api/leads] preview homes:', err)
    return NextResponse.json({ error: 'Could not load your homes just now. Please try again.' }, { status: 500 })
  }
  const allowed = (data ?? []).filter((l) => open.has(l.id as string) || l.is_custom || l.postcard_job_id)
  return NextResponse.json({ leads: allowed })
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

  // Join the user's newest batch so the lead lands in "New leads" alongside
  // what's already there. Only the monthly drop starts a new batch.
  let leadMonth: string
  try {
    leadMonth = await latestBatchMonth(supabase, user.id)
  } catch (err) {
    console.error('Custom lead: could not read the latest batch:', err)
    return NextResponse.json({ error: 'Could not add the address just now. Please try again.' }, { status: 500 })
  }

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
    console.error('[POST /api/leads]', error)
    return NextResponse.json({ error: 'Could not add the address just now. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ lead: data }, { status: 201 })
}
