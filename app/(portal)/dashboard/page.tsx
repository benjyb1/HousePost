export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeWithCache } from '@/lib/geocoding/postcodes-io'
import { FailedPostcardsNotice } from '@/components/dashboard/FailedPostcardsNotice'
import { HomeClient, type HomeLead } from '@/components/portal/home/HomeClient'

/*
  Home (the signed-in landing page, at /dashboard so login, emails and
  notifications keep working). The list, the map and the checkout sit side by
  side. Data is read exactly as the old Leads page read it; the only addition is
  each home's position for the map, which lives in property_transactions (RLS
  denies users, so it is read server-side with the admin client and only for
  this user's own leads).
*/
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const PAGE = 1000
  const MAX = 5000 // safety bound: newest leads first, so older ones drop off
  const leadsQuery = (from: number) =>
    supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('lead_month', { ascending: false })
      .order('distance_miles', { ascending: true })
      .range(from, from + PAGE - 1)

  const thirtyDaysAgoIso = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [firstPage, { data: profile }, { data: recentFailures }] = await Promise.all([
    leadsQuery(0),
    supabase
      .from('profiles')
      .select('subscription_status, postcard_design_url, postcard_design_back_url, postcards_used_this_period, search_radius_miles, min_price, max_price, property_types, office_lat, office_lng, failed_notice_dismissed_at')
      .eq('id', user.id)
      .single(),
    supabase.from('postcard_jobs').select('failed_at').eq('user_id', user.id).eq('status', 'failed').gte('failed_at', thirtyDaysAgoIso),
  ])

  // Page past PostgREST's 1000-row cap so earlier homes aren't truncated.
  const rows = firstPage.data ?? []
  if (rows.length === PAGE) {
    for (let from = PAGE; from < MAX; from += PAGE) {
      const { data } = await leadsQuery(from)
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < PAGE) break
    }
  }

  // Map positions. Unsent leads only: sent ones live in Tracking.
  const unsent = rows.filter((r) => !r.postcard_job_id)
  const coords = new Map<string, { lat: number; lng: number }>()
  const txIds = [...new Set(unsent.map((r) => r.transaction_id as string | null).filter((v): v is string => !!v))]
  if (txIds.length) {
    const admin = createAdminClient()
    const CHUNK = 200
    const chunks: string[][] = []
    for (let i = 0; i < txIds.length; i += CHUNK) chunks.push(txIds.slice(i, i + CHUNK))
    const results = await Promise.all(
      chunks.map((ids) => admin.from('property_transactions').select('id, lat, lng').in('id', ids))
    )
    for (const { data } of results) {
      for (const t of data ?? []) {
        if (t.lat != null && t.lng != null) coords.set(`tx:${t.id}`, { lat: t.lat as number, lng: t.lng as number })
      }
    }
  }
  // Homes added by hand have no transaction: place them by postcode.
  const customPostcodes = [...new Set(unsent.filter((r) => !r.transaction_id).map((r) => String(r.postcode ?? '').toUpperCase().trim()).filter(Boolean))]
  if (customPostcodes.length) {
    try {
      const geo = await geocodeWithCache(customPostcodes)
      for (const pc of customPostcodes) {
        const g = geo.get(pc)
        if (g) coords.set(`pc:${pc}`, { lat: g.lat, lng: g.lng })
      }
    } catch {
      // No position just means no marker; the home still shows in the list.
    }
  }

  const leads: HomeLead[] = rows.map((r) => {
    const pos = r.transaction_id ? coords.get(`tx:${r.transaction_id}`) : coords.get(`pc:${String(r.postcode ?? '').toUpperCase().trim()}`)
    return {
      id: r.id as string,
      addressLine: r.address_line as string,
      postcode: r.postcode as string,
      price: (r.price as number | null) ?? null,
      propertyType: (r.property_type as string | null) ?? null,
      distance: (r.distance_miles as number | null) ?? null,
      soldOn: (r.date_of_transfer as string | null) ?? null,
      month: r.lead_month as string,
      selected: !!r.selected_for_dispatch,
      jobId: (r.postcard_job_id as string | null) ?? null,
      custom: !!r.is_custom,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
    }
  })

  const dismissedAtMs = profile?.failed_notice_dismissed_at ? Date.parse(profile.failed_notice_dismissed_at as string) : 0
  const unseenFailures = (recentFailures ?? [])
    .map((f) => f.failed_at as string | null)
    .filter((at): at is string => !!at && Date.parse(at) > dismissedAtMs)
  const latestFailedAt = unseenFailures.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a), unseenFailures[0] ?? '')

  const status = (profile?.subscription_status as string) ?? 'incomplete'

  return (
    <>
      {unseenFailures.length > 0 && (
        <div className="mx-auto max-w-[1480px] px-4 pt-6 sm:px-8">
          <FailedPostcardsNotice count={unseenFailures.length} latestFailedAt={latestFailedAt} />
        </div>
      )}
      <HomeClient
        userId={user.id}
        leads={leads}
        prefs={{
          radius: (profile?.search_radius_miles as number | null) ?? 10,
          min: (profile?.min_price as number | null) ?? null,
          max: (profile?.max_price as number | null) ?? null,
          types: ((profile?.property_types as string[] | null) ?? ['D', 'S', 'T', 'F', 'O']),
        }}
        office={profile?.office_lat != null && profile?.office_lng != null ? { lat: profile.office_lat as number, lng: profile.office_lng as number } : null}
        subscribed={status === 'active' || status === 'trialing'}
        frontUrl={(profile?.postcard_design_url as string | null)?.trim() || null}
        backUrl={(profile?.postcard_design_back_url as string | null)?.trim() || null}
        used={(profile?.postcards_used_this_period as number | null) ?? 0}
      />
    </>
  )
}
