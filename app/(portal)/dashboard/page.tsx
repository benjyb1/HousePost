export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Mail, CreditCard, Building } from 'lucide-react'
import { currentMonthKey, formatMonthKey } from '@/lib/utils/date'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const monthKey = currentMonthKey()

  const [{ data: profile }, { count: leadCount }, { count: postcardCount }] = await Promise.all([
    supabase.from('profiles').select('full_name, subscription_status, postcards_used_this_period, search_radius_miles, office_postcode').eq('id', user.id).single(),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('lead_month', monthKey),
    supabase.from('postcard_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('lead_month', monthKey),
  ])

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-amber-100 text-amber-800',
    canceled: 'bg-red-100 text-red-800',
    incomplete: 'bg-slate-100 text-slate-700',
  }
  const statusColor = statusColors[profile?.subscription_status ?? 'incomplete'] ?? 'bg-slate-100 text-slate-700'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{formatMonthKey(monthKey)} overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Leads this month</CardTitle>
            <MapPin className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leadCount ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">properties found</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Postcards sent</CardTitle>
            <Mail className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{postcardCount ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">dispatched this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Allowance used</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{profile?.postcards_used_this_period ?? 0}<span className="text-lg text-slate-400">/10</span></p>
            <p className="text-xs text-slate-500 mt-1">included postcards</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Subscription</CardTitle>
            <Building className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor}`}>
              {profile?.subscription_status ?? 'Inactive'}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              {profile?.search_radius_miles ?? 10} mile radius · {profile?.office_postcode ?? '–'}
            </p>
          </CardContent>
        </Card>
      </div>

      {(leadCount ?? 0) === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="font-medium text-slate-600">No leads yet for {formatMonthKey(monthKey)}</p>
            <p className="text-sm text-slate-400 mt-1">
              Leads are generated on the 22nd of each month from Land Registry data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
