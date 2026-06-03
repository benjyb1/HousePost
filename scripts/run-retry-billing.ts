/**
 * Retry billing for overage postcards that didn't get metered at dispatch time
 * (e.g. a transient Stripe failure). Dispatch and resend already self-heal on a
 * user's NEXT send via billPendingOverage(); this cron closes the gap for users
 * who don't come back soon, so nothing is ever reconciled by hand.
 *
 * Safe to run as often as you like: each overage card is metered with a
 * per-job idempotency key, so Stripe dedupes and an already-billed card is
 * skipped (its stripe_payment_intent_id is already set).
 *
 * Usage: npx tsx scripts/run-retry-billing.ts
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { billPendingOverage } from '@/lib/stripe/billing'
import { sendAdminAlert } from '@/lib/email/resend'

async function main() {
  const supabase = createAdminClient()

  // Every dispatched overage card that hasn't been metered yet.
  const { data: pending, error } = await supabase
    .from('postcard_jobs')
    .select('user_id')
    .eq('status', 'dispatched')
    .eq('was_included_in_subscription', false)
    .is('stripe_payment_intent_id', null)

  if (error) {
    console.error('❌  Could not read pending overage:', error.message)
    process.exit(1)
  }

  const userIds = [...new Set((pending ?? []).map((r) => r.user_id as string))]
  if (userIds.length === 0) {
    console.log('✅  No unbilled overage — nothing to do.')
    return
  }

  console.log(`💳  ${userIds.length} user(s) with unbilled overage cards.`)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, stripe_customer_id')
    .in('id', userIds)

  const customerById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.stripe_customer_id as string | null])
  )

  let totalBilled = 0
  const failures: string[] = []

  for (const userId of userIds) {
    const customerId = customerById.get(userId)
    if (!customerId) {
      failures.push(`${userId}: no stripe_customer_id on profile`)
      continue
    }
    try {
      const billed = await billPendingOverage(userId, customerId)
      totalBilled += billed
      if (billed > 0) console.log(`  • ${userId}: billed ${billed} card(s)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`${userId}: ${msg}`)
      console.error(`  ✗ ${userId}: ${msg}`)
    }
  }

  console.log(
    `✅  Swept ${userIds.length} user(s); billed ${totalBilled} card(s); ${failures.length} still pending.`
  )

  // Persistent failures stay pending and get retried next run, but flag them so
  // a misconfiguration (e.g. STRIPE_METER_EVENT_NAME unset) doesn't hide forever.
  if (failures.length > 0) {
    try {
      await sendAdminAlert(
        `[Housepost] Overage retry left ${failures.length} card(s) unbilled`,
        `<p>The overage-billing sweep couldn't meter some cards. They stay pending and retry next run — but if this persists, check STRIPE_METER_EVENT_NAME and the affected customers:</p><pre>${failures.join('\n')}</pre>`
      )
    } catch (e) {
      console.error('Failed to send admin alert:', e)
    }
  }
}

main()
