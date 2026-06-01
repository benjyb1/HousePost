import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeSingleWithCache } from '@/lib/geocoding/postcodes-io'
import { geocodeWithCache } from '@/lib/geocoding/postcodes-io'
import { geocodeTransactionsForMonth } from '@/lib/geocoding/postcodes-io'
import { expandRadius } from './radius-expander'

interface LeadGenerationResult {
  leadsCreated: number
  hitMaxRadius: boolean
  radiusUsed: number
}

/**
 * Generate leads for a single user for the given importMonth.
 * Geocodes property postcodes as needed, saves leads to DB.
 */
export async function generateLeadsForUser(
  userId: string,
  importMonth: string
): Promise<LeadGenerationResult> {
  const supabase = createAdminClient()

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('office_postcode, office_lat, office_lng, search_radius_miles, min_price, max_price, property_types')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    throw new Error(`Profile not found for user ${userId}: ${profileError?.message}`)
  }

  // Geocode office postcode if not already cached
  let officeLat = profile.office_lat as number | null
  let officeLng = profile.office_lng as number | null

  if (officeLat == null || officeLng == null) {
    const geo = await geocodeSingleWithCache(profile.office_postcode)
    if (!geo) {
      throw new Error(`Could not geocode office postcode: ${profile.office_postcode}`)
    }
    officeLat = geo.lat
    officeLng = geo.lng

    await supabase
      .from('profiles')
      .update({ office_lat: officeLat, office_lng: officeLng })
      .eq('id', userId)
  }

  // Query and expand radius
  const { transactions, radiusUsed, hitMaxRadius } = await expandRadius(
    officeLat,
    officeLng,
    importMonth,
    profile.search_radius_miles ?? 10,
    {
      propertyTypes: (profile.property_types as string[]) ?? [],
      minPrice: profile.min_price as number | null,
      maxPrice: profile.max_price as number | null,
    }
  )

  // Geocode any missing postcodes in the transactions
  const ungeocoded = transactions.filter((t) => t.lat == null || t.lng == null)
  if (ungeocoded.length > 0) {
    const postcodes = [...new Set(ungeocoded.map((t) => t.postcode))]
    const geoMap = await geocodeWithCache(postcodes)

    for (const t of ungeocoded) {
      const geo = geoMap.get(t.postcode.toUpperCase().trim())
      if (geo) {
        t.lat = geo.lat
        t.lng = geo.lng
      }
    }

    // Update geocoded rows in DB
    for (const t of ungeocoded) {
      if (t.lat != null && t.lng != null) {
        await supabase
          .from('property_transactions')
          .update({ lat: t.lat, lng: t.lng, geocoded_at: new Date().toISOString() })
          .eq('id', t.id)
      }
    }
  }

  // Build lead rows
  const leadRows = transactions.map((tx) => ({
    user_id: userId,
    transaction_id: tx.id,
    address_line: tx.address_line,
    postcode: tx.postcode,
    price: tx.price,
    property_type: tx.property_type,
    is_new_build: tx.is_new_build,
    tenure: tx.tenure,
    date_of_transfer: tx.date_of_transfer,
    distance_miles: tx.distanceMiles,
    selected_for_dispatch: false,
    lead_month: importMonth,
  }))

  if (leadRows.length === 0) {
    return { leadsCreated: 0, hitMaxRadius, radiusUsed }
  }

  // Insert only leads we don't already have for this user+month, then plain
  // insert. We can't upsert with onConflict here: the custom-leads migration
  // replaced the unique constraint with a PARTIAL unique index (it only applies
  // where transaction_id IS NOT NULL, so custom leads can have a null one), and
  // PostgREST can't target a partial index — every upsert threw "no unique or
  // exclusion constraint matching the ON CONFLICT specification" and produced 0
  // leads. Filtering to new rows also preserves state (selected_for_dispatch,
  // postcard_job_id, archived_at) on any lead the user has already touched.
  const { data: existing, error: existingError } = await supabase
    .from('leads')
    .select('transaction_id')
    .eq('user_id', userId)
    .eq('lead_month', importMonth)
    .not('transaction_id', 'is', null)

  if (existingError) {
    throw new Error(
      `Failed to read existing leads for user ${userId}: ${existingError.message}`
    )
  }

  const existingIds = new Set((existing ?? []).map((r) => r.transaction_id))
  const newLeads = leadRows.filter((r) => !existingIds.has(r.transaction_id))

  if (newLeads.length === 0) {
    return { leadsCreated: 0, hitMaxRadius, radiusUsed }
  }

  // Insert in batches so a large first month doesn't exceed request limits.
  const insertBatchSize = 1000
  for (let i = 0; i < newLeads.length; i += insertBatchSize) {
    const batch = newLeads.slice(i, i + insertBatchSize)
    const { error: insertError } = await supabase.from('leads').insert(batch)
    if (insertError) {
      throw new Error(`Failed to insert leads for user ${userId}: ${insertError.message}`)
    }
  }

  return { leadsCreated: newLeads.length, hitMaxRadius, radiusUsed }
}

/**
 * Generate leads for all active subscribers.
 * Processes users in batches of 5 for reasonable parallelism.
 */
export async function generateLeadsForAllUsers(importMonth: string): Promise<{
  usersProcessed: number
  totalLeads: number
  usersAtMaxRadius: number
  errors: string[]
}> {
  const supabase = createAdminClient()

  // Make sure this month's transactions are geocoded before any user is matched.
  // The import does this too, but running it here also backfills any month that
  // was imported before geocoding existed, and covers an import that skipped it.
  await geocodeTransactionsForMonth(importMonth)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .in('subscription_status', ['active', 'trialing'])

  if (error) throw new Error(`Failed to fetch profiles: ${error.message}`)

  const userIds = (profiles ?? []).map((p) => p.id as string)
  let totalLeads = 0
  let usersAtMaxRadius = 0
  const errors: string[] = []

  // Process in batches of 5
  for (let i = 0; i < userIds.length; i += 5) {
    const batch = userIds.slice(i, i + 5)
    const results = await Promise.allSettled(
      batch.map((id) => generateLeadsForUser(id, importMonth))
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'fulfilled') {
        totalLeads += result.value.leadsCreated
        if (result.value.hitMaxRadius) usersAtMaxRadius++
      } else {
        const msg = `User ${batch[j]}: ${result.reason?.message ?? String(result.reason)}`
        errors.push(msg)
        console.error('Lead generation error:', msg)
      }
    }
  }

  return { usersProcessed: userIds.length, totalLeads, usersAtMaxRadius, errors }
}
