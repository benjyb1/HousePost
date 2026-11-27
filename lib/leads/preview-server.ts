import type { SupabaseClient } from '@supabase/supabase-js'
import { pickPreviewIds, type PreviewPrefs, type PreviewRow } from './preview'

export function prefsFromProfile(profile: {
  search_radius_miles?: unknown
  min_price?: unknown
  max_price?: unknown
  property_types?: unknown
} | null | undefined): PreviewPrefs {
  return {
    radius: (profile?.search_radius_miles as number | null) ?? 10,
    min: (profile?.min_price as number | null) ?? null,
    max: (profile?.max_price as number | null) ?? null,
    types: (profile?.property_types as string[] | null) ?? ['D', 'S', 'T', 'F', 'O'],
  }
}

/**
 * The ids of the homes a non-subscriber may see in full (see pickPreviewIds).
 * Reads unsent homes, archived ones included, newest first. The open five
 * always come from the top of that order, so two pages are plenty.
 */
export async function loadPreviewIds(admin: SupabaseClient, userId: string, prefs: PreviewPrefs): Promise<Set<string>> {
  const PAGE = 1000
  const page = (from: number) =>
    admin
      .from('leads')
      .select('id, address_line, postcode, price, property_type, distance_miles, lead_month, is_custom')
      .eq('user_id', userId)
      .is('postcard_job_id', null)
      .order('lead_month', { ascending: false })
      .order('distance_miles', { ascending: true })
      .order('id')
      .range(from, from + PAGE - 1)

  const results = await Promise.all([page(0), page(PAGE)])
  const rows: PreviewRow[] = []
  for (const { data, error } of results) {
    if (error) throw new Error(`Could not read homes for the preview: ${error.message}`)
    for (const r of data ?? []) {
      rows.push({
        id: r.id as string,
        addressLine: (r.address_line as string) ?? '',
        postcode: (r.postcode as string | null) ?? '',
        price: (r.price as number | null) ?? null,
        propertyType: (r.property_type as string | null) ?? null,
        distance: (r.distance_miles as number | null) ?? null,
        month: r.lead_month as string,
        custom: !!r.is_custom,
      })
    }
  }
  return pickPreviewIds(rows, prefs)
}
