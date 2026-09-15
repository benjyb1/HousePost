import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeSingleWithCache } from '@/lib/geocoding/postcodes-io'
import { haversineDistanceMiles, boundingBox } from '@/lib/geocoding/haversine'

// Reads the service-role client + external geocoding — must run on Node and never
// be statically cached (results depend on the query string and live data).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const DEFAULT_RADIUS_MILES = 5
export const MIN_RADIUS_MILES = 1
export const MAX_RADIUS_MILES = 50

// Page through the bounding-box result set in chunks. We only ever pull the three
// columns the aggregate needs (price/lat/lng) and never return the rows to the
// client — the caller gets two numbers. The cap is a safety valve so a huge
// radius over a dense city can't scan unbounded; typical marketing radii
// (1–15 miles) are nowhere near it.
const PAGE_SIZE = 1000
const MAX_ROWS_SCANNED = 50_000

export interface HousesSoldSuccess {
  ok: true
  /** Normalised postcode that was actually geocoded, e.g. "SW1A 1AA" */
  postcode: string
  radiusMiles: number
  /** Latest import_month present in the data, YYYY-MM */
  month: string
  /** Homes sold within the radius in that month */
  count: number
  /** Average price in pence, or null when count === 0 */
  averagePricePence: number | null
  /** True if the row cap was hit and the count is a floor rather than exact */
  capped: boolean
}

export interface HousesSoldFailure {
  ok: false
  code: 'invalid_postcode' | 'no_data' | 'bad_request'
  error: string
}

export type HousesSoldResult = HousesSoldSuccess | HousesSoldFailure

/** Parse and clamp a raw radius value to the allowed range, falling back to the default. */
export function clampRadius(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_MILES
  return Math.min(MAX_RADIUS_MILES, Math.max(MIN_RADIUS_MILES, n))
}

/**
 * Core public lookup: for the most recent month of Land Registry data we hold,
 * how many homes sold within `radiusMiles` of `postcodeInput`, and at what
 * average price.
 *
 * "Most recent complete month" is derived from the data itself as the maximum
 * `import_month` present — the unit the whole pipeline treats as "a month" of
 * data (see lib/land-registry/importer.ts and lib/leads/radius-expander.ts).
 * Each import_month is one complete monthly snapshot, so the latest one is the
 * most recent complete month available; we never hardcode a date.
 *
 * Radius filtering mirrors the lead pipeline exactly: a cheap bounding-box
 * pre-filter in SQL (uses idx_pt_lat_lng), then an exact Haversine distance
 * check in JS to trim the box down to a true circle.
 */
export async function lookupHousesSold(
  postcodeInput: string,
  radiusMiles: number
): Promise<HousesSoldResult> {
  if (!postcodeInput || !postcodeInput.trim()) {
    return { ok: false, code: 'bad_request', error: 'Please enter a postcode.' }
  }

  const supabase = createAdminClient()

  // 1. Geocode the postcode (postcodes.io + postcode_cache).
  const geo = await geocodeSingleWithCache(postcodeInput)
  if (!geo) {
    return {
      ok: false,
      code: 'invalid_postcode',
      error: `We couldn't find the postcode "${postcodeInput.trim()}". Please check it and try again.`,
    }
  }

  // 2. Derive the latest month of data from the data itself.
  const { data: latest, error: latestError } = await supabase
    .from('property_transactions')
    .select('import_month')
    .order('import_month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    throw new Error(`Failed to read latest month: ${latestError.message}`)
  }
  if (!latest) {
    return { ok: false, code: 'no_data', error: 'No sales data is available yet.' }
  }
  const month = latest.import_month as string

  // 3. Bounding-box pre-filter in SQL, exact Haversine in JS, aggregate as we go.
  const box = boundingBox(geo.lat, geo.lng, radiusMiles)

  let count = 0
  let sumPence = 0
  let capped = false

  for (let from = 0; ; from += PAGE_SIZE) {
    if (from >= MAX_ROWS_SCANNED) {
      capped = true
      break
    }

    const { data, error } = await supabase
      .from('property_transactions')
      .select('price, lat, lng')
      .eq('import_month', month)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', box.minLat)
      .lte('lat', box.maxLat)
      .gte('lng', box.minLng)
      .lte('lng', box.maxLng)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Houses-sold query failed: ${error.message}`)
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      const d = haversineDistanceMiles(
        geo.lat,
        geo.lng,
        row.lat as number,
        row.lng as number
      )
      if (d <= radiusMiles) {
        count++
        sumPence += row.price as number
      }
    }

    if (data.length < PAGE_SIZE) break
  }

  return {
    ok: true,
    postcode: geo.postcode,
    radiusMiles,
    month,
    count,
    averagePricePence: count > 0 ? Math.round(sumPence / count) : null,
    capped,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const postcode = searchParams.get('postcode') ?? ''
  const radius = clampRadius(searchParams.get('radius'))

  const result = await lookupHousesSold(postcode, radius)

  if (!result.ok) {
    const status = result.code === 'no_data' ? 503 : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}
