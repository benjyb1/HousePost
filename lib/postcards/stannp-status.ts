// Fulfilment status polling.
//
// The dispatch helper (lib/postcards/stannp.ts) hands artwork + an address to
// the print/post provider and stores the returned item id on the job. That id
// never changes, but the item's status advances over the following days
// (received → in production → printed → dispatched). Nothing pulls those later
// states back into our database on its own, so this helper fetches the current
// status for a given item id and normalises it.
//
// IMPORTANT: every value this module returns is a neutral, provider-agnostic
// status key (the same keys the Tracking page already labels). The print
// supplier's name never appears in a returned value — callers store and display
// these keys only, so the user only ever sees "Printed", "Dispatched", etc.
//
// We reuse the same base URL + HTTP Basic auth pattern as lib/postcards/stannp.ts
// (API key as the username, empty password) but keep this in a separate file so
// the dispatch helper stays untouched.

const FULFILMENT_BASE = 'https://api-eu1.stannp.com/v1'

/** The neutral status keys understood by the Tracking page's label/colour maps. */
export type NormalisedStatus =
  | 'pending'
  | 'received'
  | 'processing'
  | 'production'
  | 'printed'
  | 'dispatched'
  | 'delivered'
  | 'held'
  | 'dispatching'
  | 'provider_hold'
  | 'error'
  | 'failed'
  | 'cancelled'

/**
 * Statuses we treat as terminal — once a job reaches one of these there is no
 * point polling it again. `dispatched` is terminal because the provider hands
 * the item to Royal Mail at that point and reports nothing further for standard
 * mail; `delivered` is included for completeness in case a tracked product ever
 * reports it. `error`/`failed`/`cancelled` will not advance on their own.
 */
export const TERMINAL_STATUSES: readonly NormalisedStatus[] = [
  'dispatched',
  'delivered',
  'failed',
  'cancelled',
  'error',
]

export function isTerminalStatus(status: string | null | undefined): boolean {
  return !!status && (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * Map the raw status strings the fulfilment API can return onto our neutral
 * keys. The API's vocabulary is not fully guaranteed and can vary by product,
 * so we map every spelling we know of and fall back gracefully for anything
 * unrecognised (see normaliseFulfilmentStatus). These raw values SHOULD be
 * confirmed against the provider's live docs / account — see the report.
 */
const RAW_STATUS_MAP: Record<string, NormalisedStatus> = {
  // Just accepted into the queue.
  new: 'received',
  created: 'received',
  accepted: 'received',
  received: 'received',
  // Being validated / prepared, pre-production.
  pending: 'processing',
  queued: 'processing',
  processing: 'processing',
  in_progress: 'processing',
  proofed: 'processing',
  // On the press.
  production: 'production',
  in_production: 'production',
  printing: 'production',
  // Printed, waiting to be posted.
  printed: 'printed',
  produced: 'printed',
  // Handed to the carrier (Royal Mail) — terminal for standard mail.
  dispatched: 'dispatched',
  posted: 'dispatched',
  mailed: 'dispatched',
  shipped: 'dispatched',
  sent: 'dispatched',
  complete: 'dispatched',
  completed: 'dispatched',
  // Optional delivery confirmation (tracked products only).
  delivered: 'delivered',
  // Manually held for review by the provider. This is a DISTINCT state from our
  // internal cool-off 'held' (pre-send). Mapping it to 'held' would collide with
  // the cool-off state and let the release cron re-send an already-dispatched
  // card, so provider holds get their own neutral, NON-terminal key.
  held: 'provider_hold',
  hold: 'provider_hold',
  on_hold: 'provider_hold',
  onhold: 'provider_hold',
  // Stopped / failed states.
  cancelled: 'cancelled',
  canceled: 'cancelled',
  refunded: 'cancelled',
  failed: 'failed',
  rejected: 'error',
  error: 'error',
}

/**
 * Normalise any raw fulfilment status string to one of our neutral keys.
 * Unknown values default to `processing` (a safe, non-terminal "in flight"
 * label) rather than leaking the raw provider vocabulary to the UI.
 */
export function normaliseFulfilmentStatus(
  raw: string | null | undefined
): NormalisedStatus | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!key) return null
  return RAW_STATUS_MAP[key] ?? 'processing'
}

interface FulfilmentItemData {
  id: number | string
  status?: string
}

interface FulfilmentResponse {
  success: boolean
  data?: FulfilmentItemData
  error?: string
}

/**
 * Fetch the current status of a single dispatched postcard by its fulfilment
 * item id and return it as a normalised, neutral status key.
 *
 * Returns `null` when the provider reports no usable status (so the caller can
 * simply leave the job unchanged). Throws on a transport / auth / API error so
 * the caller can count it as a per-item failure and carry on with the batch.
 */
export async function fetchPostcardStatus(
  itemId: string
): Promise<NormalisedStatus | null> {
  const apiKey = process.env.STANNP_API_KEY
  if (!apiKey) throw new Error('STANNP_API_KEY is not set')

  // Retrieve a single mailing item. The exact path SHOULD be confirmed against
  // the provider's live API docs (see report) — this mirrors the create call's
  // `/postcards/...` namespace.
  const response = await fetch(
    `${FULFILMENT_BASE}/postcards/get/${encodeURIComponent(itemId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        Accept: 'application/json',
      },
      // Never let a slow status check hang the whole batch.
      signal: AbortSignal.timeout(15_000),
    }
  )

  let payload: FulfilmentResponse
  try {
    payload = (await response.json()) as FulfilmentResponse
  } catch {
    throw new Error(`Status API error ${response.status}: non-JSON response`)
  }

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(
      `Status API error ${response.status}: ${payload.error ?? JSON.stringify(payload)}`
    )
  }

  return normaliseFulfilmentStatus(payload.data.status)
}
