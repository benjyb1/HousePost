/**
 * Checks for PATCH /api/settings and POST /api/postcards/designs. Pure, so
 * the rules can be tested without a request.
 */

export const PROPERTY_TYPES = ['D', 'S', 'T', 'F', 'O'] as const
const MAX_PRICE_PENCE = 100_000_000_000 // £1bn, well past any house
const MAX_NAME = 120
const MAX_URL = 1000

/**
 * A design file must be a public URL in this project's postcard-designs
 * bucket, inside the user's own folder. That is where every upload and
 * template save puts it, and it stops a profile pointing the printer at
 * anyone else's artwork or at another site.
 */
export function isOwnDesignUrl(value: string, userId: string, supabaseUrl: string): boolean {
  if (value.length > MAX_URL) return false
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/postcard-designs/${userId}/`
  if (!value.startsWith(prefix)) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  // No climbing out of the folder, however it's spelt.
  const path = decodeURIComponent(url.pathname)
  if (path.includes('..') || path.includes('\\') || path.includes('//')) return false
  return url.href.startsWith(prefix)
}

type Ok<T> = { ok: true; value: T }
type Err = { ok: false; error: string }
const ok = <T>(value: T): Ok<T> => ({ ok: true, value })
const err = (error: string): Err => ({ ok: false, error })

function optionalText(v: unknown, label: string, max = MAX_NAME): Ok<string | null> | Err {
  if (v === null) return ok(null)
  if (typeof v !== 'string') return err(`${label} must be text.`)
  const t = v.trim()
  if (t.length > max) return err(`${label} can be at most ${max} characters.`)
  return ok(t || null)
}

function price(v: unknown, label: string): Ok<number | null> | Err {
  if (v === null || v === 0) return ok(null)
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_PRICE_PENCE) {
    return err(`${label} must be a whole number of pounds, or blank.`)
  }
  return ok(v)
}

export type SettingsPatch = Record<string, unknown>

/**
 * Turn a PATCH body into the profile update, or a plain-English error.
 * `currentPrices` is only needed when the body changes one price but not the
 * other, to check lowest < highest.
 */
export function parseSettingsPatch(
  body: unknown,
  ctx: { userId: string; supabaseUrl: string; currentPrices?: { min: number | null; max: number | null } }
): Ok<SettingsPatch> | Err {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return err('Invalid request.')
  const b = body as Record<string, unknown>
  const updates: SettingsPatch = {}

  if (b.full_name !== undefined) {
    const r = optionalText(b.full_name, 'Your name')
    if (!r.ok) return r
    updates.full_name = r.value ?? ''
  }
  if (b.company_name !== undefined) {
    const r = optionalText(b.company_name, 'Business name')
    if (!r.ok) return r
    updates.company_name = r.value
  }
  if (b.office_postcode !== undefined) {
    if (typeof b.office_postcode !== 'string') return err('Postcode must be text.')
    const pc = b.office_postcode.toUpperCase().replace(/\s+/g, ' ').trim()
    if (!/^[A-Z0-9 ]{5,8}$/.test(pc)) return err('We couldn’t find that postcode. Please check it and try again.')
    updates.office_postcode = pc
  }
  if (b.search_radius_miles !== undefined) {
    // Whole miles, 1 to 10. Home only offers those; this stops anything wider
    // (e.g. 400 miles typed into an older page) being saved.
    const r = Number(b.search_radius_miles)
    if (typeof b.search_radius_miles === 'boolean' || !Number.isInteger(r) || r < 1 || r > 10) {
      return err('Distance must be a whole number of miles from 1 to 10.')
    }
    updates.search_radius_miles = r
  }
  if (b.min_price !== undefined) {
    const r = price(b.min_price, 'The lowest price')
    if (!r.ok) return r
    updates.min_price = r.value
  }
  if (b.max_price !== undefined) {
    const r = price(b.max_price, 'The highest price')
    if (!r.ok) return r
    updates.max_price = r.value
  }
  if (b.min_price !== undefined || b.max_price !== undefined) {
    const lo = b.min_price !== undefined ? (updates.min_price as number | null) : ctx.currentPrices?.min ?? null
    const hi = b.max_price !== undefined ? (updates.max_price as number | null) : ctx.currentPrices?.max ?? null
    if (lo != null && hi != null && lo >= hi) return err('The lowest price needs to be under the highest.')
  }
  if (b.property_types !== undefined) {
    const v = b.property_types
    if (!Array.isArray(v) || v.length === 0 || v.length > PROPERTY_TYPES.length) {
      return err('Pick at least one property type.')
    }
    const set = new Set<string>()
    for (const t of v) {
      if (typeof t !== 'string' || !(PROPERTY_TYPES as readonly string[]).includes(t)) return err('Unknown property type.')
      set.add(t)
    }
    updates.property_types = PROPERTY_TYPES.filter((t) => set.has(t))
  }
  for (const key of ['postcard_design_url', 'postcard_design_back_url'] as const) {
    const v = b[key]
    if (v === undefined) continue
    if (v === null || v === '') {
      updates[key] = null
      continue
    }
    if (typeof v !== 'string' || !isOwnDesignUrl(v.trim(), ctx.userId, ctx.supabaseUrl)) {
      return err('That design file isn’t one of yours. Save the design again and retry.')
    }
    updates[key] = v.trim()
  }
  if (b.email_notifications !== undefined) {
    if (typeof b.email_notifications !== 'boolean') return err('Email setting must be on or off.')
    updates.email_notifications = b.email_notifications
  }
  return ok(updates)
}
