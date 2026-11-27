import { createHash, timingSafeEqual } from 'crypto'

/**
 * True when the request carries `Authorization: Bearer $CRON_SECRET`.
 *
 * Always false when CRON_SECRET is unset or empty, so a missing secret can
 * never be matched by "Bearer undefined" or "Bearer ".
 */
export function verifyCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = request.headers.get('authorization') ?? ''
  const digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`))
}
