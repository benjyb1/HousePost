/**
 * One-off backfill: compute suppression_list.premises_key for rows created
 * before the column existed (migration 20260921000000). Safe to re-run.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-suppression-premises-keys.ts
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { premisesKey } from '@/lib/address/normalise'

async function main() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('suppression_list')
    .select('id, raw_address, postcode, premises_key')
    .or('premises_key.is.null,premises_key.eq.')
  if (error) throw new Error(error.message)
  let n = 0
  for (const row of data ?? []) {
    const key = premisesKey(row.raw_address as string, row.postcode as string)
    const { error: updErr } = await admin.from('suppression_list').update({ premises_key: key }).eq('id', row.id)
    if (updErr) throw new Error(updErr.message)
    console.log(`${row.raw_address} -> ${key}`)
    n++
  }
  console.log(`backfilled ${n} row(s)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
