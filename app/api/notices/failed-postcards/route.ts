import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST: the user has clicked through the dashboard's "postcards could not be
 * sent" message (fix list 6.1). Stamp the account so the message stays gone on
 * refresh and on other devices; it comes back only for cards that fail after
 * this. The column isn't client-writable, so the write goes through the admin
 * client, scoped to the signed-in user.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await createAdminClient()
    .from('profiles')
    .update({ failed_notice_dismissed_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('Could not record failed-postcards notice dismissal:', error.message)
    return NextResponse.json({ error: 'Could not save that just now' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
