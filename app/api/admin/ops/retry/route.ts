import { NextResponse } from 'next/server'
import { verifyAdminCookie } from '@/lib/admin/verify'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST {} — bring every delayed card forward so the next cron run (within five
 * minutes) retries it now, instead of waiting out its backoff. Only touches
 * rows that are still 'held' with at least one retry; nothing is sent here.
 */
export async function POST() {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('postcard_jobs')
    .update({ release_at: new Date().toISOString() })
    .eq('status', 'held')
    .gt('retry_count', 0)
    .is('postgrid_letter_id', null)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, brought_forward: data?.length ?? 0 })
}
