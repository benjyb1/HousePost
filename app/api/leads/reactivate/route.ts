import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/leads/reactivate — "Send again" (feature 8.1).
 *
 * Request:  { ids: string[] }   // ids of previously-targeted leads
 * Response: { success, reactivated, skipped, ids: string[] }
 *
 * The send route (POST /api/postcards) only ever sends leads whose
 * postcard_job_id IS NULL, so to re-target a lead that was already sent we first
 * detach it from its old job here (clear postcard_job_id) and reset its
 * selection. The client then runs the normal preview -> confirm send flow with
 * the returned ids.
 *
 * Send history is preserved: the old rows in `postcard_jobs` are left completely
 * untouched (they keep their own denormalised recipient snapshot and lead_id) —
 * we only null the pointer on the `leads` side.
 *
 * A lead is only reactivated if its previous job has actually FINISHED. Leads
 * whose job is still in flight ('pending' / 'held' / 'dispatching') are skipped
 * so we can never detach a card that is queued to post or inside its cool-off
 * window.
 */
const IN_FLIGHT_STATUSES = ['pending', 'held', 'dispatching']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await request.json().catch(() => ({}))
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  // Load the caller's leads for these ids that are actually targeted (have a job).
  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('id, postcard_job_id')
    .eq('user_id', user.id)
    .in('id', ids)
    .not('postcard_job_id', 'is', null)

  if (leadsErr) {
    return NextResponse.json({ error: leadsErr.message }, { status: 500 })
  }

  const jobIds = (leads ?? []).map((l) => l.postcard_job_id as string)
  if (jobIds.length === 0) {
    return NextResponse.json({ success: true, reactivated: 0, skipped: ids.length, ids: [] })
  }

  // Find which of those jobs are still in flight, so we can exclude their leads.
  const { data: jobs, error: jobsErr } = await supabase
    .from('postcard_jobs')
    .select('id, status')
    .in('id', jobIds)

  if (jobsErr) {
    return NextResponse.json({ error: jobsErr.message }, { status: 500 })
  }

  const inFlightJobIds = new Set(
    (jobs ?? [])
      .filter((j) => IN_FLIGHT_STATUSES.includes(j.status as string))
      .map((j) => j.id as string)
  )

  const reactivatableIds = (leads ?? [])
    .filter((l) => !inFlightJobIds.has(l.postcard_job_id as string))
    .map((l) => l.id as string)

  if (reactivatableIds.length === 0) {
    return NextResponse.json({ success: true, reactivated: 0, skipped: ids.length, ids: [] })
  }

  // Detach from the old job and reset selection. Admin client so we can clear the
  // link even though the standard UPDATE policy would normally allow it too;
  // history in postcard_jobs is deliberately left as-is.
  const admin = createAdminClient()
  const { error: updateErr, count } = await admin
    .from('leads')
    .update({ postcard_job_id: null, selected_for_dispatch: false }, { count: 'exact' })
    .in('id', reactivatableIds)
    .eq('user_id', user.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    reactivated: count ?? reactivatableIds.length,
    skipped: ids.length - reactivatableIds.length,
    ids: reactivatableIds,
  })
}
