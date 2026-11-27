import type { SupabaseClient } from '@supabase/supabase-js'
import { sendLeadsReadyEmail } from '@/lib/email/resend'
import { createNotification } from '@/lib/notifications'

type PerUser = Record<string, { hitMaxRadius?: boolean; radiusUsed?: number } | undefined>

/** ops_state key marking that this month's "your homes are ready" email went to this user. */
const markerKey = (leadMonth: string, userId: string) => `leads-ready-email:${leadMonth}:${userId}`

/**
 * Tell each subscriber their homes for `leadMonth` are ready: one email each
 * (and, from the cron route, an in-app notification).
 *
 * Each user is marked in ops_state once their email has gone, and anyone
 * already marked is skipped. So a run that stops part way (a timeout, a
 * crash, or the route and the GitHub script both firing) can be run again
 * without emailing anyone twice. Five users at a time; with a deadline, no new
 * batch starts after it and the rest are left for the next run.
 */
export async function sendLeadDropEmails(
  supabase: SupabaseClient,
  leadMonth: string,
  perUser: PerUser,
  opts: { notify: boolean; deadline?: number }
): Promise<{ sent: number; alreadySent: number; failed: number; deferred: number }> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('subscription_status', ['active', 'trialing'])
  if (error) throw new Error(`Could not read subscribers: ${error.message}`)

  const { data: markers, error: markerErr } = await supabase
    .from('ops_state')
    .select('key')
    .like('key', `leads-ready-email:${leadMonth}:%`)
  if (markerErr) throw new Error(`Could not read sent-email markers: ${markerErr.message}`)
  const done = new Set((markers ?? []).map((m) => m.key as string))

  let sent = 0
  let alreadySent = 0
  let failed = 0
  let deferred = 0
  const todo = (profiles ?? []).filter((p) => {
    if (done.has(markerKey(leadMonth, p.id as string))) {
      alreadySent++
      return false
    }
    return true
  })

  for (let i = 0; i < todo.length; i += 5) {
    if (opts.deadline && Date.now() > opts.deadline) {
      deferred = todo.length - i
      break
    }
    await Promise.all(
      todo.slice(i, i + 5).map(async (profile) => {
        const userId = profile.id as string
        const { count, error: countErr } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('lead_month', leadMonth)
        if (countErr) {
          failed++
          console.error(`Lead email: could not count homes for ${userId}:`, countErr.message)
          return
        }
        const leadCount = count ?? 0
        if (leadCount === 0) return

        const userResult = perUser[userId]
        try {
          await sendLeadsReadyEmail({
            to: profile.email as string,
            name: profile.full_name as string,
            leadCount,
            monthKey: leadMonth,
            hitMaxRadius: userResult?.hitMaxRadius ?? false,
            radiusUsed: userResult?.radiusUsed ?? 10,
          })
          sent++
        } catch (e) {
          failed++
          console.error(`Lead email: failed for ${userId}:`, e)
          return
        }

        const { error: markErr } = await supabase
          .from('ops_state')
          .upsert({ key: markerKey(leadMonth, userId), value: { at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        if (markErr) console.error(`Lead email: could not mark ${userId} as sent:`, markErr.message)

        if (opts.notify) {
          // sendEmail:false because the leads-ready email above covers the email side.
          await createNotification({
            userId,
            type: 'leads_dropped',
            title: `${leadCount} new lead${leadCount === 1 ? '' : 's'} just dropped`,
            href: '/leads',
            sendEmail: false,
          })
        }
      })
    )
  }

  return { sent, alreadySent, failed, deferred }
}
