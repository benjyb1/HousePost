import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocodeSingleWithCache } from '@/lib/geocoding/postcodes-io'
import { parseSettingsPatch } from '@/lib/validation/settings'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[GET /api/settings]', error)
    return NextResponse.json({ error: 'Could not load your settings just now.' }, { status: 500 })
  }
  return NextResponse.json({ profile: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)

  // Changing one price but not the other: check against the saved one.
  let currentPrices: { min: number | null; max: number | null } | undefined
  const b = (body ?? {}) as Record<string, unknown>
  if ((b.min_price === undefined) !== (b.max_price === undefined)) {
    const { data: cur, error: curErr } = await supabase
      .from('profiles')
      .select('min_price, max_price')
      .eq('id', user.id)
      .single()
    if (curErr) {
      console.error('[PATCH /api/settings] read prices:', curErr)
      return NextResponse.json({ error: 'Could not save just now. Please try again.' }, { status: 500 })
    }
    currentPrices = { min: (cur?.min_price as number | null) ?? null, max: (cur?.max_price as number | null) ?? null }
  }

  const parsed = parseSettingsPatch(body, {
    userId: user.id,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    currentPrices,
  })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const updates = parsed.value

  // Re-geocode if postcode changed
  if (typeof updates.office_postcode === 'string') {
    const geo = await geocodeSingleWithCache(updates.office_postcode)
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

  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    console.error('[PATCH /api/settings]', error)
    return NextResponse.json({ error: 'Could not save just now. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
