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
 * Geocode every property_transactions row for a given import_month that is
 * still missing coordinates, and write lat/lng back to the table.
 *
 * Without this, freshly imported transactions have no lat/lng, and the radius
 * query in lead generation excludes them (it requires lat/lng to be non-null) —
 * so every user gets zero leads. This step is what makes imported data usable.
 *
 * Safe to run repeatedly: it only touches rows where lat is still null.
 */
export async function geocodeTransactionsForMonth(
  importMonth: string
): Promise<{ rowsGeocoded: number; postcodesResolved: number; postcodesFailed: number }> {
  const supabase = createAdminClient()

  // Collect the raw (as-stored) postcodes of every ungeocoded row for the month.
  // We page through because a month can hold tens of thousands of rows.
  const rawPostcodes = new Set<string>()
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('property_transactions')
      .select('postcode')
      .eq('import_month', importMonth)
      .is('lat', null)
      .not('postcode', 'is', null)
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(`Failed to read ungeocoded transactions: ${error.message}`)
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      if (row.postcode) rawPostcodes.add(String(row.postcode))
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  if (rawPostcodes.size === 0) {
    return { rowsGeocoded: 0, postcodesResolved: 0, postcodesFailed: 0 }
  }

  // Look up each unique normalised postcode once (cache + postcodes.io bulk).
  const uniqueNormalised = [...new Set([...rawPostcodes].map(normalise))]
  const geo = await geocodeWithCache(uniqueNormalised)

  // Write coordinates back, grouped by the exact stored postcode value so the
  // .eq() match is reliable regardless of how the raw value was cased/spaced.
  let rowsGeocoded = 0
  let postcodesResolved = 0
  let postcodesFailed = 0

  for (const raw of rawPostcodes) {
    const coords = geo.get(normalise(raw))
    if (!coords) {
      postcodesFailed++
      continue
    }
    postcodesResolved++

    const { error, count } = await supabase
      .from('property_transactions')
      .update(
        { lat: coords.lat, lng: coords.lng, geocoded_at: new Date().toISOString() },
        { count: 'exact' }
      )
      .eq('import_month', importMonth)
      .eq('postcode', raw)
      .is('lat', null)

    if (error) {
      throw new Error(`Failed to write coordinates for ${raw}: ${error.message}`)
    }
    rowsGeocoded += count ?? 0
  }

  return { rowsGeocoded, postcodesResolved, postcodesFailed }
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
