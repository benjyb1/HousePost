import { createElement } from 'react'
import Link from 'next/link'
import { MapPin, Mail, Bell, Clock, AlertTriangle, Truck, MailCheck, MailX } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/date'
import type { Notification } from '@/lib/notifications'
import s from './notifications.module.css'

/** Same icon per notification type as the dashboard feed's NotificationRow. */
function iconFor(type: string) {
  switch (type) {
    case 'leads_dropped':
      return MapPin
    case 'leads_purchased':
      return Mail
    case 'postcard_delayed':
      return Clock
    case 'postcard_failed':
      return AlertTriangle
    case 'postcard_dispatched':
      return Truck
    case 'postcard_delivered':
      return MailCheck
    case 'postcard_returned':
      return MailX
    default:
      return Bell
  }
}

/** One row on /notifications, Paper look. The whole row links when the notification has an href. */
export function NotificationItem({ notification: n }: { notification: Notification }) {
  // createElement rather than <Icon/> keeps react-hooks/static-components quiet.
  const icon = createElement(iconFor(n.type), { 'aria-hidden': true })

  const inner = (
    <>
      <span className={s.icon}>{icon}</span>
      <span className={s.text}>
        <span className={s.title}>
          <span>{n.title}</span>
          {!n.read && (
            <>
              <span className={s.dot} aria-hidden="true" />
              <span className="sr-only">(unread)</span>
            </>
          )}
        </span>
        {n.body && <span className={s.body}>{n.body}</span>}
        <time className={s.time} dateTime={n.created_at}>
          {formatDateTime(n.created_at)}
        </time>
      </span>
    </>
  )

  const cls = `${s.row}${n.read ? '' : ` ${s.unread}`}`
  return n.href ? (
    <Link href={n.href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}
