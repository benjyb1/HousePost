import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addressKey, premisesKey, normalisePostcode } from '@/lib/address/normalise'
import { clientIp } from '@/lib/admin/attempts'

// Writes via the service-role client — must run on Node and never be cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface OptOutSuccess {
  ok: true
}

export interface OptOutFailure {
  ok: false
  error: string
}

export type OptOutResult = OptOutSuccess | OptOutFailure

interface OptOutInput {
  addressLine1?: unknown
  addressLine2?: unknown
  town?: unknown
  postcode?: unknown
}

/**
 * Validate and record a suppression entry from the public opt-out form.
 *
 * We build a normalised comparison key from the submitted address lines +
 * postcode (the same key lead generation screens against) and insert it via the
 * service-role admin client. The raw submission is kept for audit.
 *
 * Kept as an exported function so it can be unit-tested and reused; the POST
 * handler is a thin wrapper.
 */
// Generous bounds: long enough for any real address, short enough that the
// table can't be stuffed with junk.
const MAX_LINE = 200
const MAX_TOWN = 100
const MAX_POSTCODE = 12

export async function recordOptOut(input: OptOutInput): Promise<OptOutResult> {
  const addressLine1 = String(input.addressLine1 ?? '').trim()
  const addressLine2 = String(input.addressLine2 ?? '').trim()
  const town = String(input.town ?? '').trim()
  const postcodeRaw = String(input.postcode ?? '').trim()

  if (addressLine1.length > MAX_LINE || addressLine2.length > MAX_LINE || town.length > MAX_TOWN) {
    return { ok: false, error: 'That address is longer than we can take. Please shorten it, or email info@housepost.co.uk.' }
  }
  if (postcodeRaw.length > MAX_POSTCODE) {
    return { ok: false, error: 'Please check your postcode.' }
  }

  if (!addressLine1) {
    return { ok: false, error: 'Please enter the first line of your address.' }
  }
  if (!postcodeRaw) {
    return { ok: false, error: 'Please enter your postcode.' }
  }

  // Assemble the raw address for the audit record, in Land-Registry-style order.
  const lines = [addressLine1, addressLine2, town].filter(Boolean)
  const rawAddress = lines.join(', ')

  const key = addressKey(lines, postcodeRaw)
  // Coarser second key so an entry typed without the town still matches the
  // Land Registry form of the address (see premisesKey).
  const premises = premisesKey(lines, postcodeRaw)
  const postcode = normalisePostcode(postcodeRaw)

  const supabase = createAdminClient()
  const { error } = await supabase.from('suppression_list').insert({
    address_key: key,
    premises_key: premises,
    raw_address: rawAddress,
    postcode,
    source: 'opt_out_form',
  })

  if (error) {
    // Don't leak DB internals to the caller.
    console.error('Failed to record opt-out:', error.message)
    return {
      ok: false,
      error:
        'Sorry, we could not record your request just now. Please try again, or email info@housepost.co.uk.',
    }
  }

  return { ok: true }
}

// Per-IP throttle: plenty for a household opting out a few addresses, not
// enough to flood the list. Counted in ops_state so it holds across server
// instances. If the count can't be read the request goes through: an opt-out
// must never be lost to our own fault.
const MAX_PER_HOUR = 20

async function overThrottle(ip: string): Promise<boolean> {
  const supabase = createAdminClient()
  const key = `opt-out-throttle:${ip}`
  try {
    const { data, error } = await supabase.from('ops_state').select('value').eq('key', key).maybeSingle()
    if (error) return false
    const v = data?.value as { count?: number; since?: number } | null | undefined
    const now = Date.now()
    const fresh = !v || typeof v.since !== 'number' || now - v.since > 60 * 60 * 1000
    const next = fresh ? { count: 1, since: now } : { count: (v.count ?? 0) + 1, since: v.since as number }
    if (!fresh && next.count > MAX_PER_HOUR) return true
    await supabase.from('ops_state').upsert({ key, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    return false
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (await overThrottle(clientIp(request))) {
    return NextResponse.json<OptOutFailure>(
      { ok: false, error: 'We’ve had a lot of requests from you in the last hour. Please try again later, or email info@housepost.co.uk.' },
      { status: 429 }
    )
  }

  let body: OptOutInput
  try {
    body = (await request.json()) as OptOutInput
  } catch {
    return NextResponse.json<OptOutFailure>(
      { ok: false, error: 'Invalid request.' },
      { status: 400 }
    )
  }

  const result = await recordOptOut(body)
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
}
