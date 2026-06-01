export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { LeadsTable } from '@/components/leads/LeadsTable'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const PAGE = 1000
  const MAX = 5000 // safety bound — newest leads first, so older ones drop off

  const leadsQuery = (from: number) =>
    supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('lead_month', { ascending: false })
      .order('distance_miles', { ascending: true })
      .range(from, from + PAGE - 1)

  const [firstPage, { data: profile }] = await Promise.all([
    leadsQuery(0),
    supabase.from('profiles').select('subscription_status').eq('id', user.id).single(),
  ])

  // Page past PostgREST's 1000-row cap so "Previous leads" isn't truncated.
  const leads = firstPage.data ?? []
  if (leads.length === PAGE) {
    for (let from = PAGE; from < MAX; from += PAGE) {
      const { data } = await leadsQuery(from)
      if (!data || data.length === 0) break
      leads.push(...data)
      if (data.length < PAGE) break
    }
  }

  const subscriptionStatus = profile?.subscription_status ?? 'incomplete'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">{leads.length} properties</p>
      </div>
      <LeadsTable leads={leads} subscriptionStatus={subscriptionStatus} />
    </div>
  )
}
