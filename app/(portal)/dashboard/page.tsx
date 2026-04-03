export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Mail, CreditCard, Building, CalendarDays } from 'lucide-react'
import { currentMonthKey, formatMonthKey } from '@/lib/utils/date'
import { INCLUDED_POSTCARDS_PER_MONTH } from '@/types/profile'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const monthKey = currentMonthKey()

  // Calculate previous month key
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const prevDate = new Date(year, month - 2, 1) // month-2 because Date months are 0-indexed
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  const [{ data: profile }, { count: leadCount }, { count: postcardCount }, { count: prevPostcardCount }] = await Promise.all([
    supabase.from('profiles').select('full_name, subscription_status, postcards_used_this_period, search_radius_miles, office_postcode').eq('id', user.id).single(),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('lead_month', prevMonthKey).is('archived_at', null),
    supabase.from('postcard_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('lead_month', monthKey),
    supabase.from('postcard_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('lead_month', prevMonthKey),
  ])

  const statusLabels: Record<string, string> = {
    incomplete: 'Inactive',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-amber-100 text-amber-800',
    canceled: 'bg-red-100 text-red-800',
    inactive: 'bg-slate-100 text-slate-700',
  }

  const rawStatus = profile?.subscription_status ?? 'incomplete'
  const displayStatus = statusLabels[rawStatus] ?? rawStatus
  const statusColorKey = rawStatus === 'incomplete' ? 'inactive' : rawStatus
  const statusColor = statusColors[statusColorKey] ?? 'bg-slate-100 text-slate-700'

  // Percentage change calculation for postcards sent
  const currentCount = postcardCount ?? 0
  const prevCount = prevPostcardCount ?? 0
  let percentageChange: number | null = null
  if (prevCount > 0) {
    percentageChange = Math.round(((currentCount - prevCount) / prevCount) * 100)
  }

  // Allowance progress
  const used = profile?.postcards_used_this_period ?? 0
  const progressPercent = Math.min((used / INCLUDED_POSTCARDS_PER_MONTH) * 100, 100)
  const overLimit = used > INCLUDED_POSTCARDS_PER_MONTH

  // Untapped leads
  const untappedLeads = (leadCount ?? 0) - (postcardCount ?? 0)

  // Next leads drop: 22nd of the next month
  const now = new Date()
  const nextDropMonth = now.getDate() >= 22 ? now.getMonth() + 2 : now.getMonth() + 1
  const nextDropDate = new Date(now.getFullYear(), nextDropMonth, 22)
  // Handle year rollover automatically via Date constructor
  const daysUntilDrop = Math.ceil((nextDropDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const nextDropLabel = nextDropDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{formatMonthKey(monthKey)} overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Latest leads</CardTitle>
            <MapPin className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-3xl font-bold">{leadCount ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">properties found</p>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Postcards sent</CardTitle>
            <Mail className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-3xl font-bold">{postcardCount ?? 0}</p>
            {percentageChange !== null ? (
              <p className="text-xs mt-1">
                <span className={percentageChange >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {percentageChange >= 0 ? `\u2191 ${percentageChange}%` : `\u2193 ${Math.abs(percentageChange)}%`}
                </span>
                <span className="text-slate-400 ml-1">vs last month</span>
              </p>
            ) : prevCount === 0 && currentCount > 0 ? (
              <p className="text-xs text-slate-500 mt-1">dispatched this month</p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">dispatched this month</p>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Allowance used</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-3xl font-bold">{used}<span className="text-lg text-slate-400">/{INCLUDED_POSTCARDS_PER_MONTH}</span></p>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
              <div
                className={`h-2 rounded-full transition-all ${overLimit ? 'bg-amber-500' : 'bg-brand'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">included postcards</p>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Subscription</CardTitle>
            <Building className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="flex-1">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor}`}>
              {displayStatus}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              {profile?.search_radius_miles ?? 10} mile radius &middot; {profile?.office_postcode ?? '\u2013'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Untapped leads CTA */}
      {untappedLeads > 0 ? (
        <Card className="border-brand/30 bg-brand-light/10">
          <CardContent className="py-6 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-brand">{untappedLeads} untapped lead{untappedLeads !== 1 ? 's' : ''} this month</p>
              <p className="text-sm text-slate-500 mt-0.5">These leads haven&apos;t received a postcard yet</p>
            </div>
            <Link
              href="/leads"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
            >
              View leads
            </Link>
          </CardContent>
        </Card>
      ) : (leadCount ?? 0) > 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <p className="font-medium text-slate-600">{daysUntilDrop} day{daysUntilDrop !== 1 ? 's' : ''} until new leads</p>
            <p className="text-sm text-slate-400 mt-1">Your next batch arrives on the 22nd</p>
          </CardContent>
        </Card>
      ) : null}

      {(leadCount ?? 0) === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Image src="/logo-icon.png" alt="" width={40} height={40} className="mx-auto h-10 w-10 opacity-20 mb-3" />
            <p className="font-medium text-slate-600">No leads yet for {formatMonthKey(monthKey)}</p>
            <p className="text-sm text-slate-400 mt-1">
              Leads are generated on the 22nd of each month from Land Registry data.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Next leads drop info */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
        <p className="text-sm text-slate-500">Your next leads drop on {nextDropLabel}</p>
      </div>
    </div>
  )
}
