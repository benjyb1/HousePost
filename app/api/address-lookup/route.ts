import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupPostcode } from '@/lib/address/getaddress'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const postcode = searchParams.get('postcode')

  if (!postcode?.trim()) {
    return NextResponse.json({ error: 'Postcode required' }, { status: 400 })
  }

  try {
    const addresses = await lookupPostcode(postcode)
    return NextResponse.json({ addresses })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lookup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
