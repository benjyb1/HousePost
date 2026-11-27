export const dynamic = 'force-dynamic'

import { preconnect } from 'react-dom'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeWithCache } from '@/lib/geocoding/postcodes-io'
import { addressKey } from '@/lib/address/normalise'
import { hasFullAccess } from '@/lib/leads/preview'
import { loadPreviewIds, prefsFromProfile } from '@/lib/leads/preview-server'
import { FailedPostcardsNotice } from '@/components/dashboard/FailedPostcardsNotice'
import { HomeClient, type HomeLead } from '@/components/portal/home/HomeClient'

/*
  Home (the signed-in landing page, at /dashboard so login, emails and
  notifications keep working). The list, the map and the checkout sit side by
  side. Data is read exactly as the old Leads page read it; the only addition is
  each home's position for the map, which lives in property_transactions (RLS
  denies users, so it is read server-side with the admin client and only for
  this user's own leads).

  Before subscribing, only the five open homes are sent to the browser in
  full. Every other home goes as a blank placeholder (its month and nothing
  else), so the addresses can't be read from the page source.
*/
export default async function HomePage() {
  // Open the connection to the map tiles while the data loads.
  preconnect('https://tiles.openfreemap.org', { crossOrigin: 'anonymous' })
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()])
  if (!user) return null

  const PAGE = 1000
  const MAX = 5000 // safety bound: newest leads first, so older ones drop off
  // Unsent homes only (sent ones live in Tracking), each with its map position
  // from property_transactions in the same query. RLS denies users that table,
  // so this one read uses the admin client, scoped to this user's own leads.
  // Which homes are picked is not read: picks live in the browser tab only.
  const admin = createAdminClient()
  const LEAD_COLUMNS =
    'id, address_line, postcode, price, property_type, distance_miles, date_of_transfer, lead_month, postcard_job_id, is_custom, transaction_id, property_transactions(lat, lng)'
  const leadsQuery = (from: number, withCount = false) =>
    admin
      .from('leads')
      .select(LEAD_COLUMNS, withCount ? { count: 'exact' } : undefined)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .is('postcard_job_id', null)
      .order('lead_month', { ascending: false })
      .order('distance_miles', { ascending: true })
      .order('id') // a unique last key, so no home is skipped or repeated between pages
      .range(from, from + PAGE - 1)

  const thirtyDaysAgoIso = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // The second page is asked for at the same time as the first (it comes back
  // empty for smaller accounts), so up to 2,000 homes cost one round trip.
  const [firstPage, secondPage, { data: profile }, { data: recentFailures }] = await Promise.all([
    leadsQuery(0, true),
    leadsQuery(PAGE),
    supabase
      .from('profiles')
      .select('subscription_status, postcard_design_url, postcard_design_back_url, postcards_used_this_period, search_radius_miles, min_price, max_price, property_types, office_lat, office_lng, failed_notice_dismissed_at')
      .eq('id', user.id)
      .single(),
    supabase.from('postcard_jobs').select('failed_at').eq('user_id', user.id).eq('status', 'failed').gte('failed_at', thirtyDaysAgoIso),
  ])

  // Past PostgREST's 1000-row cap: fetch the remaining pages in parallel.
  type Row = {
    id: string; address_line: string; postcode: string | null; price: number | null; property_type: string | null
    distance_miles: number | null; date_of_transfer: string | null; lead_month: string
    postcard_job_id: string | null; is_custom: boolean | null; transaction_id: string | null
    property_transactions: { lat: number | null; lng: number | null } | { lat: number | null; lng: number | null }[] | null
  }
  const rows: Row[] = [...((firstPage.data ?? []) as unknown as Row[]), ...((secondPage.data ?? []) as unknown as Row[])]
  const total = Math.min(firstPage.count ?? rows.length, MAX)
  if (total > 2 * PAGE) {
    const starts: number[] = []
    for (let from = 2 * PAGE; from < total; from += PAGE) starts.push(from)
    const pages = await Promise.all(starts.map((from) => leadsQuery(from)))
    for (const { data } of pages) rows.push(...((data ?? []) as unknown as Row[]))
  }

  const status = (profile?.subscription_status as string) ?? 'incomplete'
  const subscribed = hasFullAccess(status)
  const prefs = prefsFromProfile(profile)
  let openIds: Set<string> | null = null
  if (!subscribed) {
    try {
      openIds = await loadPreviewIds(admin, user.id, prefs)
    } catch (err) {
      // Fail closed: every home stays hidden rather than every home showing.
      console.error('[dashboard] preview homes:', err)
      openIds = new Set()
    }
    // One row per address, as the list shows them (newest month first).
    const seen = new Set<string>()
    const deduped: Row[] = []
    for (const r of rows) {
      const k = addressKey(r.address_line, r.postcode ?? '')
      if (seen.has(k)) continue
      seen.add(k)
      deduped.push(r)
    }
    rows.splice(0, rows.length, ...deduped)
  }
  const isOpen = (r: Row) => openIds == null || openIds.has(r.id)

  const coords = new Map<string, { lat: number; lng: number }>()
  for (const r of rows) {
    if (!isOpen(r)) continue
    const t = Array.isArray(r.property_transactions) ? r.property_transactions[0] : r.property_transactions
    if (t && t.lat != null && t.lng != null) coords.set(`tx:${r.transaction_id}`, { lat: t.lat, lng: t.lng })
  }
  // Homes added by hand have no transaction: place them by postcode.
  const customPostcodes = [...new Set(rows.filter((r) => !r.transaction_id && isOpen(r)).map((r) => String(r.postcode ?? '').toUpperCase().trim()).filter(Boolean))]
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

  let hidden = 0
  const leads: HomeLead[] = rows.map((r) => {
    if (!isOpen(r)) {
      hidden++
      return {
        id: `locked-${hidden}`,
        addressLine: '',
        postcode: '',
        price: null,
        propertyType: null,
        distance: null,
        soldOn: null,
        month: r.lead_month,
        jobId: null,
        custom: false,
        lat: null,
        lng: null,
        locked: true,
      }
    }
    const pos = r.transaction_id ? coords.get(`tx:${r.transaction_id}`) : coords.get(`pc:${String(r.postcode ?? '').toUpperCase().trim()}`)
    return {
      id: r.id,
      addressLine: r.address_line,
      postcode: r.postcode ?? '',
      price: r.price ?? null,
      propertyType: r.property_type ?? null,
      distance: r.distance_miles ?? null,
      soldOn: r.date_of_transfer ?? null,
      month: r.lead_month,
      jobId: r.postcard_job_id ?? null,
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
        prefs={prefs}
        office={profile?.office_lat != null && profile?.office_lng != null ? { lat: profile.office_lat as number, lng: profile.office_lng as number } : null}
        subscribed={subscribed}
        frontUrl={(profile?.postcard_design_url as string | null)?.trim() || null}
        backUrl={(profile?.postcard_design_back_url as string | null)?.trim() || null}
        used={(profile?.postcards_used_this_period as number | null) ?? 0}
      />
    </>
  )
}
