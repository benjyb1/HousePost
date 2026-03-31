import { createAdminClient } from '@/lib/supabase/admin'
import { haversineDistanceMiles, boundingBox } from '@/lib/geocoding/haversine'

export interface MatchedTransaction {
  id: string
  address_line: string
  postcode: string
  price: number
  property_type: string
  is_new_build: boolean
  tenure: string
  date_of_transfer: string
  lat: number
  lng: number
  distanceMiles: number
}

export interface ExpansionResult {
  transactions: MatchedTransaction[]
  radiusUsed: number
  hitMaxRadius: boolean
}

interface FilterOptions {
  propertyTypes?: string[]
  minPrice?: number | null
  maxPrice?: number | null
}

/**
 * Query property_transactions for the given month within a growing radius,
 * until at least minLeads are found or maxMiles is reached.
 */
export async function expandRadius(
  officeLat: number,
  officeLng: number,
  importMonth: string,
  initialRadiusMiles: number,
  filters: FilterOptions = {},
  minLeads = 15,
  stepMiles = 5,
  maxMiles = 50
): Promise<ExpansionResult> {
  const supabase = createAdminClient()
  let radius = initialRadiusMiles

  // Only include sales from the last 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoffDate = sixMonthsAgo.toISOString().slice(0, 10)

  while (true) {
    const box = boundingBox(officeLat, officeLng, radius)

    let query = supabase
      .from('property_transactions')
      .select('id, address_line, postcode, price, property_type, is_new_build, tenure, date_of_transfer, lat, lng')
      .eq('import_month', importMonth)
      .gte('date_of_transfer', cutoffDate)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', box.minLat)
      .lte('lat', box.maxLat)
      .gte('lng', box.minLng)
      .lte('lng', box.maxLng)

    if (filters.propertyTypes && filters.propertyTypes.length > 0) {
      query = query.in('property_type', filters.propertyTypes)
    }
    if (filters.minPrice != null) {
      query = query.gte('price', filters.minPrice)
    }
    if (filters.maxPrice != null) {
      query = query.lte('price', filters.maxPrice)
    }

    const { data, error } = await query.limit(5000)
    if (error) throw new Error(`Lead query failed: ${error.message}`)

    // Apply exact Haversine filter on the bounding-box result set
    const matched: MatchedTransaction[] = (data ?? [])
      .map((row) => ({
        ...row,
        distanceMiles: haversineDistanceMiles(
          officeLat,
          officeLng,
          row.lat as number,
          row.lng as number
        ),
      }))
      .filter((row) => row.distanceMiles <= radius)
      .sort((a, b) => a.distanceMiles - b.distanceMiles) as MatchedTransaction[]

    if (matched.length >= minLeads || radius >= maxMiles) {
      return {
        transactions: matched,
        radiusUsed: radius,
        hitMaxRadius: radius >= maxMiles && matched.length < minLeads,
      }
    }

    radius = Math.min(radius + stepMiles, maxMiles)
  }
}
