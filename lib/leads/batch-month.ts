import type { SupabaseClient } from '@supabase/supabase-js'
import { currentMonthKey } from '@/lib/utils/date'

/**
 * The lead_month of a user's newest batch of leads.
 *
 * "New leads" is whichever batch is newest, and only the monthly drop should
 * start a new one. So a lead the user adds by hand, or brings back from
 * Archived, joins this batch rather than starting its own: stamping it with
 * the calendar month made it the "newest batch" on the 1st of the month and
 * pushed every other lead into "Previous leads" (fix list 4.1).
 *
 * Falls back to the calendar month for a user who has no leads yet.
 */
export async function latestBatchMonth(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('leads')
    .select('lead_month')
    .eq('user_id', userId)
    .order('lead_month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Could not read the latest lead batch: ${error.message}`)
  return (data?.lead_month as string | undefined) ?? currentMonthKey()
}
