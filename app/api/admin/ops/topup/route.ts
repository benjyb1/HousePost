import { NextResponse } from 'next/server'
import { verifyAdminCookie } from '@/lib/admin/verify'
import { topUpPrintBalance, getPrintBalancePence } from '@/lib/postcards/stannp-account'

/**
 * POST { netPence } — top up the prepaid print balance from the card saved on
 * the print account. Admin-only. Returns the new balance so the page can
 * refresh without another round trip.
 */
export async function POST(request: Request) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const netPence = Number(body.netPence)
  if (!Number.isInteger(netPence) || netPence <= 0) {
    return NextResponse.json({ error: 'Enter a whole number of pounds' }, { status: 400 })
  }
  try {
    const result = await topUpPrintBalance(netPence)
    const balancePence = await getPrintBalancePence()
    return NextResponse.json({ success: true, ...result, balancePence })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Top-up failed'
    console.error('Admin top-up failed:', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
