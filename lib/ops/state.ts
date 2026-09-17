// Small key/value store for operator state (see the ops_state table). Used to
// rate-limit admin alerts so a persistent problem sends one email an hour or
// one a day, not one every cron run. Service-role only.

import type { SupabaseClient } from '@supabase/supabase-js'

type Admin = SupabaseClient

async function readState(supabase: Admin, key: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from('ops_state').select('value').eq('key', key).maybeSingle()
  if (error) {
    console.error(`ops_state read failed for ${key}:`, error.message)
    return null
  }
  return (data?.value as Record<string, unknown> | null) ?? null
}

async function writeState(supabase: Admin, key: string, value: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('ops_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error(`ops_state write failed for ${key}:`, error.message)
}

/**
 * True if no alert under `key` has been recorded in the last `minMinutes`.
 * Records the alert when it returns true, so the caller just sends. If the
 * state table is unreachable it returns true: better a duplicate email than a
 * swallowed alert.
 */
export async function shouldAlert(supabase: Admin, key: string, minMinutes: number): Promise<boolean> {
  const state = await readState(supabase, `alert:${key}`)
  const last = typeof state?.at === 'string' ? Date.parse(state.at) : NaN
  if (Number.isFinite(last) && Date.now() - last < minMinutes * 60_000) return false
  await writeState(supabase, `alert:${key}`, { at: new Date().toISOString() })
  return true
}

/** Clear an alert's rate-limit so the next occurrence emails immediately. */
export async function clearAlert(supabase: Admin, key: string): Promise<void> {
  await supabase.from('ops_state').delete().eq('key', `alert:${key}`)
}
