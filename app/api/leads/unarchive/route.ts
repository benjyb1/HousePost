import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { latestBatchMonth } from '@/lib/leads/batch-month'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Keep each PostgREST `in` list well under URL-length limits.
const CHUNK = 200

/**
 * POST { ids }: move archived leads back out of Archived (fix list 4.4).
 *
 * Every lead gets unarchived_at = now, which the UI shows as "Unarchived 27 Sep"
 * and the retention cron uses to restart its three-month auto-archive clock.
 * A lead that has never been sent rejoins the newest batch so it appears under
 * "New leads"; one that has been sent goes back under "Send again" with its
 * month untouched.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids)
    ? (body.ids as unknown[]).filter((id): id is string => typeof id === 'string' && UUID.test(id))
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  let leadMonth: string
  try {
    leadMonth = await latestBatchMonth(supabase, user.id)
  } catch (err) {
    console.error('Unarchive: could not read the latest batch:', err)
    return NextResponse.json({ error: 'Could not unarchive just now. Please try again.' }, { status: 500 })
  }

  const unarchivedAt = new Date().toISOString()
  const restored: { id: string; lead_month: string }[] = []

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)

    const unsent = await supabase
      .from('leads')
      .update({ archived_at: null, unarchived_at: unarchivedAt, lead_month: leadMonth })
      .in('id', chunk)
      .eq('user_id', user.id)
      .not('archived_at', 'is', null)
      .is('postcard_job_id', null)
      .select('id, lead_month')
    if (unsent.error) {
      return NextResponse.json({ error: unsent.error.message }, { status: 500 })
    }

    const sent = await supabase
      .from('leads')
      .update({ archived_at: null, unarchived_at: unarchivedAt })
      .in('id', chunk)
      .eq('user_id', user.id)
      .not('archived_at', 'is', null)
      .not('postcard_job_id', 'is', null)
      .select('id, lead_month')
    if (sent.error) {
      return NextResponse.json({ error: sent.error.message }, { status: 500 })
    }

    restored.push(...(unsent.data ?? []), ...(sent.data ?? []))
  }

  return NextResponse.json({ unarchived: restored, unarchivedAt })
}
