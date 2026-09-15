import type { createAdminClient } from '@/lib/supabase/admin'
import { addressKey } from '@/lib/address/normalise'

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

/**
 * Load every suppression (do-not-contact) address key into a Set, in bulk.
 *
 * Keys are produced by lib/address/normalise.ts:addressKey() on both sides so a
 * plain Set lookup is enough — no per-row queries. Used by lead generation AND
 * by the send/confirm and custom-lead-insert paths, so an opt-out recorded after
 * a batch has already dropped is still honoured before anything is posted.
 *
 * Fails CLOSED, not open. Only a genuinely-absent table (Postgres 42P01
 * undefined_table — the migration hasn't run, so there legitimately are no
 * opt-outs) is treated as "no suppressions". For ANY OTHER error we THROW: a
 * transient read failure must NOT silently disable do-not-contact screening.
 */
export async function loadSuppressionKeys(
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
 * Is a single address on the do-not-contact list? Loads the whole key set (see
 * loadSuppressionKeys) and does one lookup. Cheap enough for a single custom-lead
 * insert; for bulk screening load the set once and filter in memory instead.
 *
 * Propagates the fail-closed behaviour of loadSuppressionKeys: a transient read
 * error throws rather than returning false, so a caller can refuse the action.
 */
export async function isAddressSuppressed(
  supabase: SupabaseAdminClient,
  addressLine: string,
  postcode: string
): Promise<boolean> {
  const keys = await loadSuppressionKeys(supabase)
  if (keys.size === 0) return false
  return keys.has(addressKey(addressLine, postcode))
}
