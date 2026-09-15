export const dynamic = 'force-dynamic'

import { revalidatePath } from 'next/cache'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { NotificationRow } from '@/components/dashboard/RecentActivity'
import { listNotifications, markAllNotificationsRead } from '@/lib/notifications'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Leads drops and postcard activity across your account
          </p>
        </div>
        {hasUnread && (
          <form action={markAllRead}>
            <button
              type="submit"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">No notifications yet</p>
          <p className="mt-1 text-sm text-slate-400">
            You&apos;ll see activity here when new leads drop or postcards are sent.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {notifications.map((n) => (
                <NotificationRow key={n.id} notification={n} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
