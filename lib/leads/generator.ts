import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeSingleWithCache } from '@/lib/geocoding/postcodes-io'
import { geocodeWithCache } from '@/lib/geocoding/postcodes-io'
import { geocodeTransactionsForMonth } from '@/lib/geocoding/postcodes-io'
import { expandRadius } from './radius-expander'
import { addressKey } from '@/lib/address/normalise'

interface LeadGenerationResult {
  leadsCreated: number
  hitMaxRadius: boolean
  radiusUsed: number
}

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

/**
 * Load every suppression (do-not-contact) address key into a Set, in bulk.
 *
 * This is read once per generation run and used to screen out properties whose
 * occupants have opted out via /opt-out. Keys are produced by
 * lib/address/normalise.ts:addressKey() on both sides so a plain Set lookup is
 * enough — no per-row queries.
 *
 * Fails soft ONLY for a genuinely-absent table: if suppression_list does not
 * yet exist (Postgres 42P01 undefined_table — the migration hasn't been applied,
 * so there legitimately are no opt-outs), we log and return an empty set so lead
 * generation still works. An empty table likewise yields an empty set. For ANY
 * OTHER error we THROW: a transient read failure must NOT silently disable
 * do-not-contact screening (that would post to people who opted out). The thrown
 * error fails the generation run and fires the existing admin failure alert.
 */
async function loadSuppressionKeys(
  supabase: SupabaseAdminClient
): Promise<Set<string>> {
  const keys = new Set<string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('suppression_list')
      .select('address_key')
      .range(from, from + PAGE - 1)

    if (error) {
      // Only an absent table fails soft (migration not applied yet). Anything
      // else must fail loudly so we never post to opted-out addresses.
      if (error.code === '42P01') {
        console.warn(`Suppression list table absent, skipping screening: ${error.message}`)
        return keys
      }
      throw new Error(`Failed to load suppression list: ${error.message}`)
    }
    if (!data || data.length === 0) break
    for (const row of data) {
      if (row.address_key) keys.add(row.address_key as string)
    }
    if (data.length < PAGE) break
  }
  return keys
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

  // Suppression screening: drop any property whose normalised address key is on
  // the do-not-contact list. Load the whole set once and filter in memory (no
  // per-row queries). If the list is empty/absent this is a no-op.
  const suppressionKeys = await loadSuppressionKeys(supabase)
  const allowedLeads =
    suppressionKeys.size === 0
      ? leadRows
      : leadRows.filter(
          (r) => !suppressionKeys.has(addressKey(r.address_line, r.postcode))
        )

  if (allowedLeads.length === 0) {
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
  // Page past Supabase's 1000-row default. A user with a large batch (loose
  // filters / wide radius) can already have more than 1000 leads for the month;
  // reading only the first 1000 leaves the dedup set incomplete, so the plain
  // insert below collides on the (user, transaction, month) unique index and
  // the whole user's generation fails. Loop until every page is read.
  const existingIds = new Set<string>()
  const DEDUP_PAGE = 1000
  for (let from = 0; ; from += DEDUP_PAGE) {
    const { data: existing, error: existingError } = await supabase
      .from('leads')
      .select('transaction_id')
      .eq('user_id', userId)
      .eq('lead_month', importMonth)
      .not('transaction_id', 'is', null)
      .order('transaction_id', { ascending: true })
      .range(from, from + DEDUP_PAGE - 1)

    if (existingError) {
      throw new Error(
        `Failed to read existing leads for user ${userId}: ${existingError.message}`
      )
    }
    if (!existing || existing.length === 0) break
    for (const r of existing) existingIds.add(r.transaction_id as string)
    if (existing.length < DEDUP_PAGE) break
  }
  const newLeads = allowedLeads.filter((r) => !existingIds.has(r.transaction_id))

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
export type PerUserResult = { leadsCreated: number; hitMaxRadius: boolean; radiusUsed: number }

export async function generateLeadsForAllUsers(importMonth: string): Promise<{
  usersProcessed: number
  totalLeads: number
  usersAtMaxRadius: number
  errors: string[]
  perUser: Record<string, PerUserResult>
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
  const perUser: Record<string, PerUserResult> = {}

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
        perUser[batch[j]] = result.value
      } else {
        const msg = `User ${batch[j]}: ${result.reason?.message ?? String(result.reason)}`
        errors.push(msg)
        console.error('Lead generation error:', msg)
      }
    }
  }

  return { usersProcessed: userIds.length, totalLeads, usersAtMaxRadius, errors, perUser }
}
