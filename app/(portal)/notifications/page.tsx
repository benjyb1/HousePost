export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { listNotifications, markAllNotificationsRead } from '@/lib/notifications'
import { NotificationItem } from '@/components/portal/notifications/NotificationItem'
import chrome from '@/components/portal/page-chrome.module.css'
import s from '@/components/portal/notifications/notifications.module.css'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Updates about your postcards and account.',
}

export default async function NotificationsPage() {
  const user = await getSessionUser()
  if (!user) return null

  const notifications = await listNotifications(user.id, 100)
  const hasUnread = notifications.some((n) => !n.read)

  async function markAllRead() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await markAllNotificationsRead(user.id)
    revalidatePath('/notifications')
    revalidatePath('/dashboard')
  }

  return (
    <div className={chrome.page}>
      <div className={s.wrap}>
        <div className={chrome.title}>
          <h1>Notifications</h1>
          {hasUnread && (
            <form action={markAllRead}>
              <button type="submit" className={chrome.textbtn}>
                Mark all as read
              </button>
            </form>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className={chrome.panel}>
            <p className={s.empty}>
              <strong>Nothing here yet</strong>
              New homes and postcard updates will show up here.
            </p>
          </div>
        ) : (
          <ul className={s.list}>
            {notifications.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
