import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

/**
 * Account deletion.
 *
 * A user may permanently close their own account. This is deliberately built to
 * PRESERVE postcard send history for the business while removing the person's
 * personal data and login.
 *
 * What this endpoint does, in order:
 *  1. Cancels the Stripe subscription (if any) — best-effort; a Stripe failure
 *     is logged but does not block account deletion.
 *  2. Detaches postcard/send history from the user: postcard_jobs.user_id is
 *     nulled so the records survive the auth-user deletion cascade. This step
 *     REQUIRES the accompanying migration
 *     (…_account_deletion_detach_history.sql) which makes postcard_jobs.user_id
 *     nullable and switches its foreign key to ON DELETE SET NULL. Until that
 *     migration is applied this UPDATE fails, which safely aborts the whole
 *     operation BEFORE anything destructive happens — see the guard below.
 *  3. Anonymises the profile row (nulls personal fields, marks deleted_at) as
 *     defence-in-depth in case a later step fails partway.
 *  4. Deletes the Supabase auth user. Because profiles.id references
 *     auth.users(id) ON DELETE CASCADE, this also removes the (already
 *     anonymised) profile row. postcard_jobs are NOT removed — they were
 *     detached in step 2.
 *
 * NET RESULT — deleted vs preserved:
 *   DELETED:    the Supabase auth login, and (via cascade) the profile row.
 *   ANONYMISED: personal fields on the profile immediately before it is removed.
 *   PRESERVED:  every postcard_jobs row (send/dispatch history), detached from
 *               the user (user_id = null). Stripe customer/subscription records
 *               remain in Stripe (subscription cancelled).
 *
 * This is destructive and MUST be reviewed by a human before it is relied on in
 * production. See the migration note in the PR/report.
 */
/** Every object path under `${prefix}/` in a bucket, recursing into folders. */
async function listAllObjects(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const out: string[] = []
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) throw new Error(error.message)
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`
    // Folders come back without an id; files carry one.
    if (entry.id) out.push(path)
    else out.push(...(await listAllObjects(admin, bucket, path)))
  }
  return out
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // 0. Refuse deletion while any order is still in flight. A 'held' order has
  //    been charged and is waiting out its cool-off; a 'dispatching' one is
  //    mid-send. Deleting now would strand that charge (and detach the history it
  //    belongs to) — the user must let these finish or cancel them first.
  //    A 'pending' row is a charge whose outcome was ambiguous and is awaiting
  //    operator reconciliation, so it blocks deletion too.
  const { count: inFlightCount, error: inFlightErr } = await admin
    .from('postcard_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'held', 'dispatching'])

  if (inFlightErr) {
    console.error('Account deletion: failed to check in-flight orders:', inFlightErr.message)
    return NextResponse.json(
      { error: 'Could not verify your account state. Please try again shortly.' },
      { status: 500 }
    )
  }
  if ((inFlightCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'You have postcard orders that are still being processed. Please wait for them to send, or cancel them, before deleting your account.',
      },
      { status: 409 }
    )
  }

  // 1. Look up the profile for Stripe references.
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_subscription_id, stripe_customer_id')
    .eq('id', user.id)
    .single()

  // 2. Cancel the Stripe subscription if there is one. Best-effort: we log and
  //    carry on so a Stripe outage can't trap a user in their account.
  if (profile?.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id as string)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      console.error(`Account deletion: failed to cancel subscription for ${user.id}:`, message)
    }
  }

  // 3. Detach send history so it survives the auth-user deletion cascade.
  //    Acts as the safety guard: if the migration isn't applied yet, user_id is
  //    still NOT NULL and this fails, aborting before we delete anything.
  const { error: detachError } = await admin
    .from('postcard_jobs')
    .update({ user_id: null })
    .eq('user_id', user.id)

  if (detachError) {
    console.error('Account deletion: failed to detach postcard history:', detachError.message)
    return NextResponse.json(
      {
        error:
          'Could not delete account: send history could not be preserved. Please contact support.',
      },
      { status: 500 }
    )
  }

  // 4. Anonymise the profile (defence-in-depth; the row is removed by cascade in
  //    the next step, but this guarantees no personal data lingers if that fails).
  await admin
    .from('profiles')
    .update({
      full_name: '',
      email: '',
      company_name: null,
      office_postcode: '',
      office_lat: null,
      office_lng: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: 'canceled',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  // 4b. Remove the person's uploaded files (postcard artwork, design-brief
  //     assets). Storage objects are not covered by the database cascade, so
  //     without this every deleted account leaves orphaned files behind.
  //     Best-effort: a storage error must not trap the user in their account.
  for (const bucket of ['postcard-designs', 'design-request-assets']) {
    try {
      const paths = await listAllObjects(admin, bucket, user.id)
      if (paths.length > 0) {
        const { error: removeErr } = await admin.storage.from(bucket).remove(paths)
        if (removeErr) console.error(`Account deletion: failed to remove ${bucket} files:`, removeErr.message)
      }
    } catch (err) {
      console.error(`Account deletion: failed to list ${bucket} files:`, err)
    }
  }

  // 5. Delete the auth login. Cascades to the (anonymised) profile row.
  const { error: authError } = await admin.auth.admin.deleteUser(user.id)
  if (authError) {
    console.error('Account deletion: failed to delete auth user:', authError.message)
    return NextResponse.json(
      { error: 'Could not delete your login. Please contact support.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
