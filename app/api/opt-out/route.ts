import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addressKey, normalisePostcode } from '@/lib/address/normalise'

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
export async function recordOptOut(input: OptOutInput): Promise<OptOutResult> {
  const addressLine1 = String(input.addressLine1 ?? '').trim()
  const addressLine2 = String(input.addressLine2 ?? '').trim()
  const town = String(input.town ?? '').trim()
  const postcodeRaw = String(input.postcode ?? '').trim()

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
  const postcode = normalisePostcode(postcodeRaw)

  const supabase = createAdminClient()
  const { error } = await supabase.from('suppression_list').insert({
    address_key: key,
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

export async function POST(request: Request) {
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
