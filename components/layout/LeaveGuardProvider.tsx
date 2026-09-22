'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmLeaveDialog } from '@/components/postcards/ConfirmLeaveDialog'
import { decidePopstate, isInAppNavigation, LEAVE_GUARD_SENTINEL } from './leave-guard'

type LeaveGuardContextValue = {
  /** Register whether the current page has unsaved edits (the design editor calls this). */
  setDirty: (dirty: boolean) => void
  /** Run `action` immediately when clean, or hold it behind the confirm dialog when dirty. */
  guard: (action: () => void) => void
}

const LeaveGuardContext = createContext<LeaveGuardContextValue | null>(null)

/** Read the portal leave-guard. Must be called under a <LeaveGuardProvider>. */
export function useLeaveGuard(): LeaveGuardContextValue {
  const ctx = useContext(LeaveGuardContext)
  if (!ctx) throw new Error('useLeaveGuard must be used within a LeaveGuardProvider')
  return ctx
}

/**
 * Portal-wide "you have unsaved changes" guard. While a page has registered
 * `dirty`:
 * - the browser asks before closing/reloading the tab (`beforeunload`);
 * - clicks on in-app links (sidebar etc.) are held until the user confirms;
 * - the browser Back button is held via a history sentinel and routed through
 *   the same dialog;
 * - `guard(action)` holds any in-page action (page back buttons, Sign-out) too.
 *
 * When nothing is dirty none of this is active, so ordinary navigation and the
 * Back button behave normally. No auth logic lives here — Sign-out is only
 * gated, never changed.
 */
export function LeaveGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)

  // Read the latest pending action inside native event handlers without having
  // to re-bind them every time it changes.
  const pendingRef = useRef(pending)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  const guard = useCallback(
    (action: () => void) => {
      if (dirty) setPending(() => action)
      else action()
    },
    [dirty]
  )

  const confirm = useCallback(() => {
    const action = pending
    setPending(null)
    action?.()
  }, [pending])
  const cancel = useCallback(() => setPending(null), [])

  useEffect(() => {
    if (!dirty) return

    // Tab close / reload.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // legacy browsers need a value to show the prompt
    }

    // In-app <a> clicks (sidebar etc.). Capture phase so this runs before Next's
    // <Link> handler.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const target = new URL(anchor.href, window.location.href)
      if (!isInAppNavigation(target, new URL(window.location.href))) return
      e.preventDefault()
      e.stopPropagation()
      const href = target.pathname + target.search
      setPending(() => () => router.push(href))
    }

    // Browser Back. A same-URL sentinel entry sits on top of the real one, so
    // the first Back press lands on the sentinel (URL unchanged) and fires
    // popstate instead of leaving.
    const pushSentinel = () => {
      window.history.pushState(
        { ...window.history.state, [LEAVE_GUARD_SENTINEL]: true },
        '',
        window.location.href
      )
    }
    if (!window.history.state?.[LEAVE_GUARD_SENTINEL]) pushSentinel()

    const onPopState = () => {
      const decision = decidePopstate({ dirty, dialogOpen: pendingRef.current !== null })
      if (decision === 'ignore') return
      // The Back press consumed our sentinel; re-push so the user stays put.
      pushSentinel()
      if (decision === 'prompt') {
        setPending(() => () => {
          // "Leave anyway": stop guarding, then step past our sentinel *and* the
          // guarded entry to reach where Back was actually headed.
          window.removeEventListener('popstate', onPopState)
          window.history.go(-2)
        })
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
      // If our sentinel is still on top (edits saved without a Back press), drop
      // it so the user's next Back press isn't wasted. The listener is already
      // gone, so this silent same-URL pop shows no dialog.
      if (window.history.state?.[LEAVE_GUARD_SENTINEL]) window.history.back()
    }
  }, [dirty, router])

  const value = useMemo(() => ({ setDirty, guard }), [guard])

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}
      <ConfirmLeaveDialog open={pending !== null} onConfirm={confirm} onCancel={cancel} />
    </LeaveGuardContext.Provider>
  )
}
