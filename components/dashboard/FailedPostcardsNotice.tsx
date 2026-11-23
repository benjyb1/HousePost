'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'

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
      className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-line bg-paper-hi px-4 py-3 text-[14.5px] leading-normal text-ink transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-navy"
    >
      <span>
        <strong className="font-semibold text-[#8a3324]">
          {count} postcard{count === 1 ? '' : 's'} could not be sent
        </strong>{' '}
        recently.
      </span>
      <span className="font-semibold text-navy-ink underline underline-offset-4 group-hover:no-underline">See why in Tracking</span>
    </Link>
  )
}
