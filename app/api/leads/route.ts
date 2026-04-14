import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentMonthKey } from '@/lib/utils/date'

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
