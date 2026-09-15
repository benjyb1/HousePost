import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail } from '@/lib/email/resend'

/**
 * Notification event kinds.
 *
 * Kept open (a plain string union that still permits arbitrary strings via the
 * `type` param below) so new kinds can be introduced without a DB migration —
 * the `notifications.type` column is free text by design.
 */
export type NotificationType = 'leads_dropped' | 'leads_purchased'

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  href: string | null
  read: boolean
  created_at: string
}

export interface CreateNotificationInput {
  /** The owning user (profiles.id / auth user id). */
  userId: string
  /** Event kind, e.g. 'leads_dropped' | 'leads_purchased'. */
  type: NotificationType | (string & {})
  /** Short headline shown in the feed. */
  title: string
  /** Optional longer message. */
  body?: string | null
  /** Optional in-app link, e.g. '/leads'. */
  href?: string | null
  /**
   * Whether to also send the email counterpart (default true). Set false when a
   * dedicated email already covers this event — e.g. lead drops, where
   * `sendLeadsReadyEmail` is sent separately, so the generic notification email
   * would be a duplicate.
   */
  sendEmail?: boolean
}

/**
 * Insert a notification for a user.
 *
 * Server-side only — uses the service-role client so it works from cron jobs and
 * API routes regardless of the request's auth context. The integrator calls this
 * from the lead-generation flow (`type: 'leads_dropped'`) and the postcard-send
 * flow (`type: 'leads_purchased'`).
 *
 * Returns the created row, or `null` if the insert failed (failures are logged
 * and swallowed so a notification write can never break the calling flow).
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[notifications] createNotification failed:', error.message)
    return null
  }

  const notification = data as Notification

  // After a successful insert, also email the user — but only if they've opted
  // in (email_notifications) and this event wants an email. Any failure here is
  // logged and swallowed so a broken email can never fail notification creation.
  if (input.sendEmail !== false) {
    await maybeSendNotificationEmail(supabase, notification)
  }

  return notification
}

/**
 * Send the email counterpart of a just-created notification, gated on the
 * user's `email_notifications` preference.
 *
 * Fetches the target user's email, name and preference via the service-role
 * client. Sends only when the preference is TRUE. All errors are caught and
 * logged — this is intentionally best-effort and never throws to its caller.
 */
async function maybeSendNotificationEmail(
  supabase: ReturnType<typeof createAdminClient>,
  notification: Notification
): Promise<void> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, full_name, email_notifications')
      .eq('id', notification.user_id)
      .single()

    if (error) {
      console.error(
        '[notifications] could not load profile for email:',
        error.message
      )
      return
    }

    // Respect the opt-out. Treat a missing/null value as opted-in, matching the
    // column default (email_notifications BOOLEAN NOT NULL DEFAULT TRUE).
    if (profile?.email_notifications === false) return
    if (!profile?.email) return

    await sendNotificationEmail({
      to: profile.email,
      name: profile.full_name ?? 'there',
      title: notification.title,
      body: notification.body,
      href: notification.href,
    })
  } catch (err) {
    console.error(
      '[notifications] sendNotificationEmail failed:',
      err instanceof Error ? err.message : err
    )
  }
}

/**
 * List a user's notifications, newest first.
 *
 * Uses the request-scoped server client, so RLS ensures a user only ever reads
 * their own rows. Used by both the dashboard recent-activity feed and the
 * full /notifications page.
 *
 * @param userId the owning user id
 * @param limit  maximum rows to return (default 20)
 */
export async function listNotifications(
  userId: string,
  limit = 20
): Promise<Notification[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[notifications] listNotifications failed:', error.message)
    return []
  }

  return (data ?? []) as Notification[]
}

/** Mark a single notification as read (RLS-scoped to the owning user). */
export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
  if (error) {
    console.error('[notifications] markNotificationRead failed:', error.message)
  }
}

/** Mark all of a user's notifications as read (RLS-scoped to the owning user). */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) {
    console.error('[notifications] markAllNotificationsRead failed:', error.message)
  }
}
