import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
