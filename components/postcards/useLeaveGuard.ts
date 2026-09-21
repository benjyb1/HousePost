'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/** True for a click that would leave this page for another page in the app. */
export function isInAppNavigation(target: URL, current: URL): boolean {
  if (target.origin !== current.origin) return false
  return target.pathname + target.search !== current.pathname + current.search
}

/**
 * "You have unsaved changes" guard. While `dirty`:
 * - the browser asks before closing/reloading the tab;
 * - clicks on in-app links (sidebar etc.) are held until the user confirms;
 * - `guard(action)` holds any in-page action (back buttons) the same way.
 * When not dirty, `guard` just runs the action.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter()
  const [pending, setPending] = useState<(() => void) | null>(null)

  const guard = useCallback(
    (action: () => void) => {
      if (dirty) setPending(() => action)
      else action()
    },
    [dirty]
  )

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // legacy browsers need a value to show the prompt
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const target = new URL(anchor.href, window.location.href)
      if (!isInAppNavigation(target, new URL(window.location.href))) return
      // Capture phase, so this runs before Next's <Link> handler.
      e.preventDefault()
      e.stopPropagation()
      const href = target.pathname + target.search
      setPending(() => () => router.push(href))
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty, router])

  const confirm = useCallback(() => {
    const action = pending
    setPending(null)
    action?.()
  }, [pending])
  const cancel = useCallback(() => setPending(null), [])

  return { guard, open: pending !== null, confirm, cancel }
}
