import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocodeSingleWithCache } from '@/lib/geocoding/postcodes-io'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    full_name,
    office_postcode,
    search_radius_miles,
    min_price,
    max_price,
    property_types,
    postcard_design_url,
    postcard_design_back_url,
    company_name,
    email_notifications,
  } = body

  const updates: Record<string, unknown> = {}

  if (full_name !== undefined) updates.full_name = full_name
  if (search_radius_miles !== undefined) {
    // Whole miles, 1 to 10. Home only offers those; this stops anything wider
    // (e.g. 400 miles typed into an older page) being saved.
    const r = Number(search_radius_miles)
    if (!Number.isInteger(r) || r < 1 || r > 10) {
      return NextResponse.json({ error: 'Distance must be a whole number of miles from 1 to 10.' }, { status: 400 })
    }
    updates.search_radius_miles = r
  }
  if (min_price !== undefined) updates.min_price = min_price
  if (max_price !== undefined) updates.max_price = max_price
  if (property_types !== undefined) updates.property_types = property_types
  if (postcard_design_url !== undefined) updates.postcard_design_url = postcard_design_url
  if (postcard_design_back_url !== undefined) updates.postcard_design_back_url = postcard_design_back_url
  if (company_name !== undefined) updates.company_name = company_name
  if (email_notifications !== undefined) updates.email_notifications = email_notifications

  // Re-geocode if postcode changed
  if (office_postcode !== undefined) {
    updates.office_postcode = office_postcode.toUpperCase().trim()
    const geo = await geocodeSingleWithCache(office_postcode)
    if (geo) {
      updates.office_lat = geo.lat
      updates.office_lng = geo.lng
    } else {
      return NextResponse.json(
        { error: 'We couldn’t find that postcode. Please check it and try again.' },
        { status: 400 }
      )
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
