import Link from 'next/link'
import { MapPin, Mail, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/notifications'

/** Pick an icon for a notification type. */
function iconFor(type: string) {
  switch (type) {
    case 'leads_dropped':
      return MapPin
    case 'leads_purchased':
      return Mail
    default:
      return Bell
  }
}

/**
 * A single notification row. Shared between the dashboard feed and the full
 * /notifications page. When a `href` is present the whole row links to it.
 */
export function NotificationRow({ notification }: { notification: Notification }) {
  const Icon = iconFor(notification.type)

  const inner = (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          notification.read ? 'bg-slate-100 text-slate-400' : 'bg-brand-light/20 text-brand'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <span className="truncate">{notification.title}</span>
          {!notification.read && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />
          )}
        </p>
        {notification.body && (
          <p className="mt-0.5 text-sm text-slate-500">{notification.body}</p>
        )}
        <p className="mt-0.5 text-xs text-slate-400">{formatDate(notification.created_at)}</p>
      </div>
    </div>
  )

  if (notification.href) {
    return (
      <Link href={notification.href} className="block transition-colors hover:bg-slate-50">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}

/**
 * Dashboard "Recent activity" feed.
 *
 * The visible count is responsive via CSS: the caller passes up to 5 rows and
 * everything beyond the 3rd is hidden on small screens (`hidden lg:block`), so
 * phones show ~3 and large screens show up to ~5 without any client JS.
 */
export function RecentActivity({ notifications }: { notifications: Notification[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <Link href="/notifications" className="text-sm font-medium text-brand hover:underline">
          See all
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No activity yet.</p>
        ) : (
          <div className="divide-y">
            {notifications.slice(0, 5).map((n, i) => (
              <div key={n.id} className={i >= 3 ? 'hidden lg:block' : undefined}>
                <NotificationRow notification={n} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
