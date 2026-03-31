export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { LeadsTable } from '@/components/leads/LeadsTable'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: leads }, { data: profile }] = await Promise.all([
    supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('lead_month', { ascending: false })
      .order('distance_miles', { ascending: true }),
    supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single(),
  ])

  const subscriptionStatus = profile?.subscription_status ?? 'incomplete'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">{leads?.length ?? 0} properties</p>
      </div>
      <LeadsTable leads={leads ?? []} subscriptionStatus={subscriptionStatus} />
    </div>
  )
}
