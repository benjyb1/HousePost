// Account-level calls to the print supplier: balance and top-up.
//
// Stannp is prepaid. Every live order draws down a balance, and an empty
// balance makes /postcards/create fail with "Insufficient funds". The app uses
// these helpers to (a) refuse a send politely before charging the customer when
// the balance cannot cover it, (b) email admin when the balance runs low, and
// (c) let the operator top up from the admin page without logging into the
// supplier's dashboard.
//
// Same base URL and Basic auth as lib/postcards/stannp.ts. Kept separate so the
// dispatch helper stays small.

const STANNP_BASE = 'https://api-eu1.stannp.com'

/**
 * What one A6 card costs us, in pence, including postage. Stannp reports it on
 * every order (0.96 as of Sep 2026); override with STANNP_UNIT_COST_PENCE if
 * pricing changes. Used only for the pre-flight capacity check, so a slightly
 * stale figure errs on the side of refusing a send, never on posting unpaid.
 */
export function printUnitCostPence(): number {
  const raw = Number(process.env.STANNP_UNIT_COST_PENCE)
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 96
}

/** Below this the admin gets a daily "top up" email. Default £20. */
export function lowBalancePence(): number {
  const raw = Number(process.env.STANNP_LOW_BALANCE_PENCE)
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 2000
}

function authHeader(): string {
  const apiKey = process.env.STANNP_API_KEY
  if (!apiKey) throw new Error('STANNP_API_KEY is not set')
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
}

/**
 * Current prepaid balance in pence, or null if the supplier could not tell us
 * (network blip, auth problem). Callers must treat null as "unknown", not as
 * zero: a monitoring call must never block a send on its own.
 */
export async function getPrintBalancePence(): Promise<number | null> {
  try {
    const res = await fetch(`${STANNP_BASE}/v1/accounts/balance`, {
      headers: { Authorization: authHeader() },
      // Never let a slow balance check hold up a customer request for long.
      signal: AbortSignal.timeout(8000),
    })
    const payload = (await res.json()) as { success?: boolean; data?: { balance?: string } }
    if (!res.ok || !payload.success || !payload.data?.balance) return null
    const pounds = Number(payload.data.balance)
    if (!Number.isFinite(pounds)) return null
    return Math.round(pounds * 100)
  } catch (err) {
    console.error('Print balance check failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Can the balance cover `cardCount` more cards? Returns `ok: true` when it can
 * OR when the balance is unknown (so a monitoring hiccup never blocks trade).
 * Returns `ok: false` with the figures when we positively know it cannot.
 */
export async function checkPrintCapacity(cardCount: number): Promise<{
  ok: boolean
  balancePence: number | null
  neededPence: number
}> {
  const neededPence = cardCount * printUnitCostPence()
  const balancePence = await getPrintBalancePence()
  if (balancePence === null) return { ok: true, balancePence, neededPence }
  return { ok: balancePence >= neededPence, balancePence, neededPence }
}

/**
 * Top up the prepaid balance from the card saved on the supplier account.
 * `netPence` is the amount before VAT; the supplier adds tax and returns the
 * gross figure charged. Requires a saved default card on the account, which is
 * a one-off in the supplier's dashboard.
 */
export async function topUpPrintBalance(netPence: number): Promise<{
  netPence: number
  taxPence: number
  grossPence: number
}> {
  const apiKey = process.env.STANNP_API_KEY
  if (!apiKey) throw new Error('STANNP_API_KEY is not set')
  if (!Number.isInteger(netPence) || netPence < 500 || netPence > 50000) {
    throw new Error('Top-up must be a whole number of pence between £5 and £500')
  }
  const res = await fetch(`${STANNP_BASE}/v2/balance`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ net: String(netPence) }),
    signal: AbortSignal.timeout(30000),
  })
  let payload: {
    data?: { status?: string; net?: number; tax?: number; gross?: number }
    error?: string
    message?: string
  }
  try {
    payload = await res.json()
  } catch {
    throw new Error(`Top-up failed: ${res.status} non-JSON response`)
  }
  if (!res.ok || !payload.data || payload.data.status !== 'success') {
    throw new Error(`Top-up failed: ${payload.error ?? payload.message ?? res.status}`)
  }
  return {
    netPence: payload.data.net ?? netPence,
    taxPence: payload.data.tax ?? 0,
    grossPence: payload.data.gross ?? netPence,
  }
}
