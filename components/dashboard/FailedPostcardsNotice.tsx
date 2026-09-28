'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

// Remembers, in this browser, the newest failure the user has already clicked
// through. The account-level record (profiles.failed_notice_dismissed_at) is
// what keeps the message gone on refresh and other devices; this copy just
// hides it at once, including when Back restores a cached dashboard.
const STORAGE_KEY = 'housepost:failed-notice-seen'
const CHANGE_EVENT = 'housepost:failed-notice-seen'

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/**
 * Dashboard message for postcards that failed recently (fix list 6.1). Once the
 * user clicks through to Tracking it disappears for good, and only comes back
 * if more cards fail after that.
 */
export function FailedPostcardsNotice({
  count,
  latestFailedAt,
}: {
  count: number
  latestFailedAt: string
}) {
  const seen = useSyncExternalStore(subscribe, readSeen, () => null)
  const alreadySeen = seen !== null && Date.parse(seen) >= Date.parse(latestFailedAt)
  if (count === 0 || alreadySeen) return null

  function markSeen() {
    try {
      window.localStorage.setItem(STORAGE_KEY, latestFailedAt)
      window.dispatchEvent(new Event(CHANGE_EVENT))
    } catch {
      // Private mode etc. The server record below still does the job.
    }
    // keepalive lets the request finish while the page navigates away.
    fetch('/api/notices/failed-postcards', { method: 'POST', keepalive: true }).catch(() => {})
  }

  return (
    <Link
      href="/postcards"
      onClick={markSeen}
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>
          {count} postcard{count === 1 ? '' : 's'} could not be sent
        </strong>{' '}
        recently. See why in Tracking.
      </span>
    </Link>
  )
}
