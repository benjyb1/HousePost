import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const selected = Boolean(body.selected)

  const { error } = await supabase
    .from('leads')
    .update({ selected_for_dispatch: selected })
    .eq('id', id)
    .eq('user_id', user.id) // RLS enforced; this is an extra safety check

  if (error) {
    console.error('[leads/select]', error)
    return NextResponse.json({ error: 'Could not update that home just now. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
