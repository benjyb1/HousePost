import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLeadsForUser } from '@/lib/leads/generator'
import { latestBatchMonth } from '@/lib/leads/batch-month'

export const maxDuration = 30

/**
 * Fetch this month's homes again for the signed-in user, after they have saved
 * wider filters on Home (Benjy, 23 Nov 2026). It runs the same generator the
 * monthly job uses, unchanged: it reads the user's saved preferences, screens
 * the do-not-contact list, and only inserts homes the user doesn't already
 * have, so calling it twice is harmless. Typically one to three seconds.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const month = await latestBatchMonth(supabase, user.id)
    const result = await generateLeadsForUser(user.id, month)
    return NextResponse.json({ month, added: result.leadsCreated })
  } catch (e) {
    console.error('[leads/refresh]', e)
    return NextResponse.json({ error: 'We could not fetch more homes just now.' }, { status: 500 })
  }
}
