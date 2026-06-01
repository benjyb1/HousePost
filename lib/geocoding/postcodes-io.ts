import { createAdminClient } from '@/lib/supabase/admin'

export interface GeocodedPostcode {
  postcode: string
  lat: number
  lng: number
}

const POSTCODES_IO_BULK_URL = 'https://api.postcodes.io/postcodes'
const BULK_LIMIT = 100

/** Normalise a UK postcode: uppercase, trim whitespace */
function normalise(postcode: string): string {
  return postcode.toUpperCase().trim()
}

/**
 * Geocode up to 100 postcodes at once via postcodes.io bulk API.
 * Returns a Map of normalised postcode → result (null if not found).
 */
export async function geocodePostcodes(
  postcodes: string[]
): Promise<Map<string, GeocodedPostcode | null>> {
  const result = new Map<string, GeocodedPostcode | null>()
  if (postcodes.length === 0) return result

  const normalised = postcodes.map(normalise)

  const response = await fetch(POSTCODES_IO_BULK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postcodes: normalised }),
  })

  if (!response.ok) {
    console.error('postcodes.io bulk request failed:', response.status)
    normalised.forEach((p) => result.set(p, null))
    return result
  }

  const data = await response.json()
  for (const item of data.result ?? []) {
    const key = normalise(item.query)
    if (item.result) {
      result.set(key, {
        postcode: key,
        lat: item.result.latitude,
        lng: item.result.longitude,
      })
    } else {
      result.set(key, null)
    }
  }

  return result
}

/**
 * Geocode property_transactions for a given import_month and write lat/lng back.
 *
 * Without this, freshly imported transactions have no lat/lng, and the radius
 * query in lead generation excludes them (it requires lat/lng to be non-null) —
 * so every user gets zero leads. This step is what makes imported data usable.
 *
 * Performance: writes are batched — one upsert per ~1000 rows rather than one
 * UPDATE per postcode (which meant tens of thousands of sequential round-trips
 * against the national monthly file). Every processed row gets `geocoded_at`
 * stamped, so:
 *   - the loop always drains and can't spin forever,
 *   - postcodes that fail to resolve aren't retried on the next run,
 *   - it's safe to run repeatedly (only un-attempted rows are touched).
 *
 * Only rows within the lead window (last 6 months of sales) are geocoded —
 * older transactions can never become a lead, so geocoding them is wasted work.
 */
export async function geocodeTransactionsForMonth(
  importMonth: string,
  batchSize = 1000
): Promise<{ rowsGeocoded: number; postcodesResolved: number; postcodesFailed: number }> {
  const supabase = createAdminClient()

  // Same cutoff the radius query uses, so we only geocode usable rows.
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoffDate = sixMonthsAgo.toISOString().slice(0, 10)

  let rowsGeocoded = 0
  const resolved = new Set<string>()
  const failed = new Set<string>()

  while (true) {
    // Always take the first page of not-yet-attempted rows. Each one gets
    // geocoded_at stamped below, so it leaves this set and the loop terminates.
    const { data: rows, error } = await supabase
      .from('property_transactions')
      .select('*')
      .eq('import_month', importMonth)
      .is('geocoded_at', null)
      .gte('date_of_transfer', cutoffDate)
      .limit(batchSize)

    if (error) {
      throw new Error(`Failed to read ungeocoded transactions: ${error.message}`)
    }
    if (!rows || rows.length === 0) break

    // Resolve the unique postcodes in this batch (cache + postcodes.io bulk).
    const normalisedInBatch = [
      ...new Set(
        rows
          .map((r) => (r.postcode ? normalise(String(r.postcode)) : ''))
          .filter(Boolean)
      ),
    ]
    const geo = await geocodeWithCache(normalisedInBatch)

    const stamp = new Date().toISOString()
    const updated = rows.map((r) => {
      const key = r.postcode ? normalise(String(r.postcode)) : ''
      const coords = key ? geo.get(key) : null
      if (coords) resolved.add(key)
      else if (key) failed.add(key)
      return {
        ...r,
        lat: coords ? coords.lat : null,
        lng: coords ? coords.lng : null,
        geocoded_at: stamp,
      }
    })

    const { error: upsertError } = await supabase
      .from('property_transactions')
      .upsert(updated, { onConflict: 'transaction_id,import_month' })

    if (upsertError) {
      throw new Error(`Failed to write coordinates: ${upsertError.message}`)
    }

    rowsGeocoded += updated.filter((r) => r.lat != null).length
  }

  return { rowsGeocoded, postcodesResolved: resolved.size, postcodesFailed: failed.size }
}

/**
 * Geocode a single postcode, with DB caching.
 * Returns null if the postcode is invalid or not found.
 */
export async function geocodeSingleWithCache(
  postcode: string
): Promise<GeocodedPostcode | null> {
  const map = await geocodeWithCache([postcode])
  return map.get(normalise(postcode)) ?? null
}

/**
 * Geocode an array of postcodes, checking the postcode_cache table first.
 * Cache misses are fetched from postcodes.io and inserted into the cache.
 */
export async function geocodeWithCache(
  postcodes: string[]
): Promise<Map<string, GeocodedPostcode | null>> {
  const supabase = createAdminClient()
  const result = new Map<string, GeocodedPostcode | null>()
  if (postcodes.length === 0) return result

  const normalised = [...new Set(postcodes.map(normalise))]

  // Check cache
  const { data: cached } = await supabase
    .from('postcode_cache')
    .select('postcode, lat, lng')
    .in('postcode', normalised)

  const cachedSet = new Set<string>()
  for (const row of cached ?? []) {
    result.set(row.postcode, { postcode: row.postcode, lat: row.lat, lng: row.lng })
    cachedSet.add(row.postcode)
  }

  // Fetch cache misses in batches of BULK_LIMIT
  const misses = normalised.filter((p) => !cachedSet.has(p))
  for (let i = 0; i < misses.length; i += BULK_LIMIT) {
    const batch = misses.slice(i, i + BULK_LIMIT)
    const geocoded = await geocodePostcodes(batch)

    // Store hits in cache
    const toInsert: { postcode: string; lat: number; lng: number }[] = []
    for (const [pc, geo] of geocoded) {
      result.set(pc, geo)
      if (geo) toInsert.push({ postcode: pc, lat: geo.lat, lng: geo.lng })
    }

    if (toInsert.length > 0) {
      await supabase.from('postcode_cache').upsert(toInsert, {
        onConflict: 'postcode',
      })
    }
  }

  return result
}
