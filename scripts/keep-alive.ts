/**
 * Supabase keep-alive ping.
 *
 * The free tier pauses a project after 7 days with no activity, and a paused
 * database makes the monthly import/generate jobs fail. This runs on a short
 * schedule and performs one trivial read so the project is never idle long
 * enough to be paused. Cheap insurance until the project moves to a paid plan.
 *
 * Usage: npx tsx scripts/keep-alive.ts
 */
import { createAdminClient } from '@/lib/supabase/admin'

async function main() {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('pipeline_runs')
    .select('id')
    .limit(1)

  if (error) {
    console.error('❌  Keep-alive query failed:', error.message)
    process.exit(1)
  }

  console.log(`✅  Keep-alive ping OK at ${new Date().toISOString()}`)
}

main()
