// Stannp prints and posts the postcards. Unlike PostGrid (which rendered HTML),
// Stannp takes the finished front and back artwork as images or PDFs and prints
// the recipient address itself, in a reserved "clear zone" on the back. So we
// just hand it two URLs (the user's saved designs) plus the address.
//
// Docs: https://www.stannp.com/uk/direct-mail-api/postcards
const STANNP_BASE = 'https://api-eu1.stannp.com/v1'

// We print A6 (148×105mm) — Stannp's default size and the closest match to the
// old 6×4" card. The artwork is supplied at 154×111mm (A6 + 3mm bleed all round)
// and Stannp trims 3mm off every edge.
export type StannpSize = 'A6' | 'A5'

export interface StannpRecipient {
  firstname: string
  lastname?: string
  address1: string
  city: string
  postcode: string
  country: 'GB'
}

interface StannpData {
  id: number | string
  status: string
  // In test mode (and alongside a live order) Stannp returns a URL to the
  // print-ready PDF — the exact artwork the printer uses. This powers the
  // on-screen "exactly what will print" proof.
  pdf?: string
  cost?: string
  format?: string
}

interface StannpResponse {
  success: boolean
  data?: StannpData
  error?: string
}

/** How long one Stannp call may take before we stop waiting. */
export const STANNP_TIMEOUT_MS = 20_000

/**
 * A Stannp call that did not create an order, or may have.
 *
 *  - 'rejected': Stannp answered and said no (bad address, no balance, bad
 *    key), or we never reached it. Nothing was created, so a retry is safe.
 *  - 'unknown': the request went out and we can't tell what happened (timed
 *    out, connection dropped, a 5xx, a reply we couldn't read). The card may
 *    already be printing. Stannp has no idempotency key for postcards, so
 *    sending again could print it twice: a person has to check first.
 */
export class StannpRequestError extends Error {
  constructor(
    message: string,
    readonly outcome: 'rejected' | 'unknown',
    readonly status: number | null = null
  ) {
    super(message)
    this.name = 'StannpRequestError'
  }
}

/** Network errors that mean the connection was never made, so nothing reached Stannp. */
const NEVER_CONNECTED = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT', 'ERR_INVALID_URL'])

/** Was the order created? Decide from the HTTP status and whether the body parsed. */
export function stannpOutcome(status: number, parsed: boolean): 'rejected' | 'unknown' {
  if (status >= 500) return 'unknown'
  if (status >= 400) return 'rejected' // Stannp (or its edge) refused the request
  // A 2xx we couldn't read may well be a created order; one that parsed and
  // said success:false is a refusal.
  return parsed ? 'rejected' : 'unknown'
}

/**
 * POST to the Stannp API with form-encoded fields and HTTP Basic auth (the API
 * key is the username, the password is empty). Throws a StannpRequestError on
 * any failure, saying whether an order might have been created.
 */
async function stannpRequest(
  path: string,
  fields: Record<string, string>
): Promise<StannpData> {
  const apiKey = process.env.STANNP_API_KEY
  if (!apiKey) throw new StannpRequestError('STANNP_API_KEY is not set', 'rejected')

  const body = new URLSearchParams(fields)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STANNP_TIMEOUT_MS)
  let response: Response
  let payload: StannpResponse | null = null
  try {
    try {
      response = await fetch(`${STANNP_BASE}${path}`, {
        method: 'POST',
        headers: {
          // Basic auth, key as username + empty password.
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      })
    } catch (err) {
      if (controller.signal.aborted) {
        throw new StannpRequestError(`Stannp API timed out after ${STANNP_TIMEOUT_MS / 1000}s`, 'unknown')
      }
      const code = (err as { cause?: { code?: string } })?.cause?.code ?? ''
      const msg = err instanceof Error ? err.message : String(err)
      throw new StannpRequestError(
        `Stannp API network error: ${msg}${code ? ` (${code})` : ''}`,
        NEVER_CONNECTED.has(code) ? 'rejected' : 'unknown'
      )
    }

    try {
      payload = (await response.json()) as StannpResponse
    } catch {
      const outcome = controller.signal.aborted ? 'unknown' : stannpOutcome(response.status, false)
      throw new StannpRequestError(`Stannp API error ${response.status}: non-JSON response`, outcome, response.status)
    }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok || !payload?.success || !payload.data) {
    throw new StannpRequestError(
      `Stannp API error ${response.status}: ${payload?.error ?? JSON.stringify(payload)}`,
      stannpOutcome(response.status, true),
      response.status
    )
  }
  return payload.data
}

/** Flatten a recipient into Stannp's `recipient[field]` form keys. */
function recipientFields(to: StannpRecipient): Record<string, string> {
  const fields: Record<string, string> = {
    'recipient[firstname]': to.firstname,
    'recipient[address1]': to.address1,
    'recipient[city]': to.city,
    'recipient[postcode]': to.postcode,
    'recipient[country]': to.country,
  }
  if (to.lastname) fields['recipient[lastname]'] = to.lastname
  return fields
}

function baseFields(params: {
  to: StannpRecipient
  frontUrl: string
  backUrl: string
  size: StannpSize
}): Record<string, string> {
  const fields: Record<string, string> = {
    size: params.size,
    front: params.frontUrl,
    back: params.backUrl,
    // Edge-to-edge: no white border, the artwork already carries its own bleed.
    padding: '0',
    // White-out the address clear zone so the recipient address and postal
    // barcode stay machine-readable over any design. Non-negotiable for
    // deliverability — an unreadable address means the card never arrives.
    clearzone: 'true',
    ...recipientFields(params.to),
  }
  const returnAddress = process.env.STANNP_RETURN_ADDRESS
  if (returnAddress) fields.return_address = returnAddress
  return fields
}

/**
 * Parse a UK address line and postcode into a Stannp recipient.
 * The Land Registry address line is "SAON, PAON, Street, Locality, Town", so the
 * post town is the last comma-separated segment.
 */
export function buildRecipient(
  addressLine: string,
  postcode: string,
  recipientName = 'The Homeowner'
): StannpRecipient {
  const [firstname, ...rest] = recipientName.split(' ')
  const segments = addressLine.split(',').map((s) => s.trim()).filter(Boolean)
  const city = segments.length > 0 ? segments[segments.length - 1] : addressLine.trim()
  return {
    firstname,
    lastname: rest.join(' ') || undefined,
    address1: addressLine,
    city,
    postcode,
    country: 'GB',
  }
}

/**
 * Only the production deployment may place live, billable orders. Preview
 * deployments and local development run against the same production database
 * and the same supplier key, so without this guard a click on a preview link
 * would post (and pay for) a real card. Set STANNP_FORCE_LIVE=true to override
 * deliberately, for example when proving the live path from a laptop.
 */
export function isLiveDispatchEnvironment(): boolean {
  if (process.env.STANNP_FORCE_LIVE === 'true') return true
  return process.env.VERCEL_ENV === 'production'
}

/**
 * Print and post a postcard. `tags` are stored against the order in Stannp
 * (comma-separated) and can be searched in its reporting: we pass our
 * per-(user, lead, batch) hash and the job id, so an order whose outcome was
 * unclear can be found by job. Stannp has no idempotency key for postcards, so
 * the real double-send guard is the atomic claim in the release cron and the
 * rule that an unclear outcome is never retried automatically.
 */
export async function sendPostcard(params: {
  to: StannpRecipient
  frontUrl: string
  backUrl: string
  size?: StannpSize
  tags?: string[]
}): Promise<{ id: string; status: string; pdfUrl: string | null }> {
  // In production the `test` field is deliberately OMITTED: Stannp defaults it
  // to off (a live, billable order), and omitting it removes any risk of a
  // stringy 'false' being read as truthy, which would silently turn every real
  // dispatch into a non-posted test. Outside production the field is set, so a
  // preview or a laptop can exercise the whole pipeline without posting a card.
  const live = isLiveDispatchEnvironment()
  if (!live) console.warn('sendPostcard: non-production environment, placing a TEST order (nothing is posted)')
  const data = await stannpRequest('/postcards/create', {
    ...baseFields({
      to: params.to,
      frontUrl: params.frontUrl,
      backUrl: params.backUrl,
      size: params.size ?? 'A6',
    }),
    ...(params.tags?.length ? { tags: params.tags.join(',') } : {}),
    ...(live ? {} : { test: 'true' }),
  })
  return { id: String(data.id), status: data.status, pdfUrl: data.pdf ?? null }
}

/**
 * Render an exact print proof through Stannp's test mode. Nothing is printed,
 * posted or charged — it returns the same print-ready PDF a live order would
 * produce, so the customer sees precisely what lands on the doormat.
 */
export async function createPostcardPreview(params: {
  to: StannpRecipient
  frontUrl: string
  backUrl: string
  size?: StannpSize
}): Promise<{ url: string }> {
  const data = await stannpRequest('/postcards/create', {
    ...baseFields({
      to: params.to,
      frontUrl: params.frontUrl,
      backUrl: params.backUrl,
      size: params.size ?? 'A6',
    }),
    test: 'true',
  })
  if (!data.pdf) {
    throw new Error('Stannp did not return a preview PDF — please try again')
  }
  return { url: data.pdf }
}
