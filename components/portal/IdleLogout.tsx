'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Feature 6.2 — sign the user out after this long with no interaction. Postcard
// sending charges a saved card, so an unattended session on a shared machine is
// a real risk; a hard client-side timeout is the deliverable here.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
// How often we check the idle clock. Cheap, and precise enough for a 30-min
// timeout without needing to reset a timer on every mouse move.
const CHECK_INTERVAL_MS = 30 * 1000
// Throttle so a burst of pointer/scroll events only writes the timestamp once a
// second rather than thousands of times.
const ACTIVITY_THROTTLE_MS = 1000

export function IdleLogout() {
  const router = useRouter()
  // Seeded in the effect (not here): reading Date.now() during render is impure.
  const lastActivityRef = useRef<number>(0)
  const loggingOutRef = useRef(false)

  useEffect(() => {
    lastActivityRef.current = Date.now()
    let lastWrite = 0
    const markActivity = () => {
      const now = Date.now()
      if (now - lastWrite < ACTIVITY_THROTTLE_MS) return
      lastWrite = now
      lastActivityRef.current = now
    }

    const events: (keyof DocumentEventMap)[] = [
      'pointerdown',
      'pointermove',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
    ]
    for (const evt of events) {
      // Passive + capture: we never call preventDefault, and capture makes sure
      // scrolls inside nested containers still count as activity.
      document.addEventListener(evt, markActivity, { passive: true, capture: true })
    }

    const logout = async () => {
      if (loggingOutRef.current) return
      loggingOutRef.current = true
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // Even if sign-out fails (e.g. offline), still send them to /login so the
        // authenticated view is not left sitting open.
      }
      router.replace('/login')
    }

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        void logout()
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      for (const evt of events) {
        document.removeEventListener(evt, markActivity, { capture: true } as EventListenerOptions)
      }
    }
  }, [router])

  return null
}
