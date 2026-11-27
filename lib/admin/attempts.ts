import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Wrong admin passwords, counted per IP address in the ops_state table so the
 * count holds across server instances. Five wrong tries locks that address
 * out for fifteen minutes.
 */
export const MAX_ADMIN_ATTEMPTS = 5
export const ADMIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

export type AttemptState = { count: number; since: number }

/** Is this address locked out right now? */
export function isLockedOut(state: AttemptState | null, now: number): boolean {
  if (!state) return false
  if (now - state.since > ADMIN_ATTEMPT_WINDOW_MS) return false
  return state.count >= MAX_ADMIN_ATTEMPTS
}

/** The state after one more wrong password. A window that has run out starts again. */
export function afterFailedAttempt(state: AttemptState | null, now: number): AttemptState {
  if (!state || now - state.since > ADMIN_ATTEMPT_WINDOW_MS) return { count: 1, since: now }
  return { count: state.count + 1, since: state.since }
}

/** The caller's IP as Vercel reports it. */
export function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}

const keyFor = (ip: string) => `admin-login:${ip}`

export async function readAttempts(supabase: SupabaseClient, ip: string): Promise<AttemptState | null> {
  const { data, error } = await supabase.from('ops_state').select('value').eq('key', keyFor(ip)).maybeSingle()
  if (error) throw new Error(`Could not read admin attempts: ${error.message}`)
  const v = data?.value as Partial<AttemptState> | null | undefined
  return v && typeof v.count === 'number' && typeof v.since === 'number' ? { count: v.count, since: v.since } : null
}

export async function writeAttempts(supabase: SupabaseClient, ip: string, state: AttemptState | null): Promise<void> {
  if (!state) {
    await supabase.from('ops_state').delete().eq('key', keyFor(ip))
    return
  }
  const { error } = await supabase
    .from('ops_state')
    .upsert({ key: keyFor(ip), value: state, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error('Could not record admin attempt:', error.message)
}
