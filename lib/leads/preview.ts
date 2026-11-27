import { addressKey } from '@/lib/address/normalise'

/**
 * Before subscribing, a user can see five homes in full. The rest of their
 * list is shown as blurred placeholders, and the server never sends those
 * homes' addresses, prices or positions to the browser.
 */
export const PREVIEW_LIMIT = 5
export const MAX_RADIUS_MILES = 10

/** Full access to homes: a live or trialling subscription. past_due, unpaid etc. are not. */
export function hasFullAccess(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

export type PreviewPrefs = { radius: number; min: number | null; max: number | null; types: string[] }

export type PreviewRow = {
  id: string
  addressLine: string
  postcode: string
  price: number | null
  propertyType: string | null
  distance: number | null
  month: string
  custom: boolean
}

/** The Home filters. Homes added by hand always show. */
export function matchesPrefs(
  l: Pick<PreviewRow, 'custom' | 'distance' | 'price' | 'propertyType'>,
  p: PreviewPrefs
): boolean {
  if (l.custom) return true
  if (l.distance != null && l.distance > p.radius) return false
  if (p.min && (l.price ?? 0) < p.min) return false
  if (p.max && (l.price ?? 0) > p.max) return false
  if (p.types.length && l.propertyType && !p.types.includes(l.propertyType)) return false
  return true
}

const byNewestThenNearest = (a: PreviewRow, b: PreviewRow) => {
  if (a.month !== b.month) return a.month < b.month ? 1 : -1
  const da = a.distance ?? Number.POSITIVE_INFINITY
  const db = b.distance ?? Number.POSITIVE_INFINITY
  if (da !== db) return da < db ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Which homes a non-subscriber may see in full: the first `limit` homes from
 * the newest month, nearest first, that match their saved filters (each
 * address counted once), plus anything they added by hand.
 *
 * Pass archived homes too. Otherwise archiving an open home would open the
 * next one, and archiving five at a time would walk through the whole list.
 */
export function pickPreviewIds(rows: PreviewRow[], prefs: PreviewPrefs, limit = PREVIEW_LIMIT): Set<string> {
  const p = { ...prefs, radius: Math.min(prefs.radius, MAX_RADIUS_MILES) }
  const open = new Set<string>()
  const seen = new Set<string>()
  let count = 0
  for (const r of [...rows].sort(byNewestThenNearest)) {
    if (r.custom) {
      open.add(r.id)
      continue
    }
    const k = addressKey(r.addressLine, r.postcode)
    if (seen.has(k)) continue
    seen.add(k)
    if (count >= limit || !matchesPrefs(r, p)) continue
    open.add(r.id)
    count++
  }
  return open
}
