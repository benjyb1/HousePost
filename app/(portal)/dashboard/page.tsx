export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { HomeView, type HomeLead } from '@/components/portal/home/HomeView'

/*
  Home: the page people land on after signing in, in Freddie's chosen Paper
  layout. One page holds the saved preferences (editable in place), this
  month's homes and the earlier ones not yet sent, as a list or a map, and the
  card-and-send panel. No figures at the top: the only count is the
  "included this month" meter, because it is what you're about to spend.
*/

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const thirtyDaysAgoIso = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: profile }, { data: leadRows }, { count: delayedCount }, { data: recentFailures }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'subscription_status, postcards_used_this_period, search_radius_miles, min_price, max_price, property_types, office_postcode, office_lat, office_lng, postcard_design_url, postcard_design_back_url, failed_notice_dismissed_at'
      )
      .eq('id', user.id)
      .single(),
    // Homes not yet sent to, newest batch first (sent ones live in Tracking,
    // archived ones on the All homes page).
    supabase
      .from('leads')
      .select('id, transaction_id, address_line, postcode, price, property_type, distance_miles, date_of_transfer, selected_for_dispatch, lead_month, is_custom')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .is('postcard_job_id', null)
      .order('lead_month', { ascending: false })
      .order('distance_miles', { ascending: true })
      .limit(1000),
    supabase.from('postcard_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'held').gt('retry_count', 0),
    supabase.from('postcard_jobs').select('failed_at').eq('user_id', user.id).eq('status', 'failed').gte('failed_at', thirtyDaysAgoIso),
  ])

  const rows = leadRows ?? []

  // Map positions come from each home's sale record, which only the server
  // can read. Only this user's own homes are looked up.
  const coords = new Map<string, { lat: number; lng: number }>()
  const txIds = [...new Set(rows.map((r) => r.transaction_id as string).filter(Boolean))]
  if (txIds.length > 0) {
    const admin = createAdminClient()
    for (let i = 0; i < txIds.length; i += 300) {
      const { data } = await admin
        .from('property_transactions')
        .select('id, lat, lng')
        .in('id', txIds.slice(i, i + 300))
      for (const t of data ?? []) {
        if (typeof t.lat === 'number' && typeof t.lng === 'number') coords.set(t.id as string, { lat: t.lat, lng: t.lng })
      }
    }
  }

  const leads: HomeLead[] = rows.map((r) => {
    const c = coords.get(r.transaction_id as string)
    return {
      id: r.id as string,
      address_line: r.address_line as string,
      postcode: r.postcode as string,
      price: (r.price as number | null) ?? null,
      property_type: (r.property_type as string | null) ?? null,
      distance_miles: (r.distance_miles as number | null) ?? null,
      date_of_transfer: (r.date_of_transfer as string | null) ?? null,
      selected_for_dispatch: Boolean(r.selected_for_dispatch),
      lead_month: r.lead_month as string,
      lat: c?.lat ?? null,
      lng: c?.lng ?? null,
    }
  })

  // Failed cards only count if they failed after the user last dismissed the
  // notice (fix list 6.1).
  const dismissedAtMs = profile?.failed_notice_dismissed_at ? Date.parse(profile.failed_notice_dismissed_at as string) : 0
  const unseenFailures = (recentFailures ?? [])
    .map((f) => f.failed_at as string | null)
    .filter((at): at is string => !!at && Date.parse(at) > dismissedAtMs)
  const latestFailedAt = unseenFailures.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a), unseenFailures[0] ?? '')

  return (
    <HomeView
      leads={leads}
      subscriptionStatus={(profile?.subscription_status as string) ?? 'incomplete'}
      usedThisPeriod={(profile?.postcards_used_this_period as number) ?? 0}
      prefs={{
        radius: (profile?.search_radius_miles as number | null) ?? 3,
        minPrice: (profile?.min_price as number | null) ?? null,
        maxPrice: (profile?.max_price as number | null) ?? null,
        types: (profile?.property_types as string[] | null) ?? [],
      }}
      office={{
        postcode: (profile?.office_postcode as string | null) ?? null,
        lat: (profile?.office_lat as number | null) ?? null,
        lng: (profile?.office_lng as number | null) ?? null,
      }}
      design={{
        front: ((profile?.postcard_design_url as string | null) ?? '').trim() || null,
        back: ((profile?.postcard_design_back_url as string | null) ?? '').trim() || null,
      }}
      delayedCount={delayedCount ?? 0}
      failed={{ count: unseenFailures.length, latestAt: latestFailedAt }}
    />
  )
}
