'use client'

import { useEffect, useRef } from 'react'
import { signOutOfHousepost } from '@/lib/auth/sign-out'

// Feature 6.2 — sign the user out after this long with no interaction. Postcard
// sending charges a saved card, so an unattended session on a shared machine is
// a real risk; a hard client-side timeout is the deliverable here.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
// How often we check the idle clock. Cheap, and precise enough for a 30-min
// timeout without needing to reset a timer on every mouse move.
const CHECK_INTERVAL_MS = 30 * 1000
// Throttle so a burst of pointer/scroll events only writes the timestamp once
// every few seconds rather than thousands of times.
const ACTIVITY_THROTTLE_MS = 5000
// Last activity in ANY Housepost tab. Without sharing it, a tab left open in
// the background signed you out of the tab you were working in.
const STORAGE_KEY = 'hp-last-activity'

function readShared(): number {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0
  } catch {
    return 0
  }
}

function writeShared(at: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at))
  } catch {
    // Private mode or storage full: this tab still counts its own activity.
  }
}

export function IdleLogout() {
  // Seeded in the effect (not here): reading Date.now() during render is impure.
  const lastActivityRef = useRef<number>(0)
  const loggingOutRef = useRef(false)

  useEffect(() => {
    const start = Date.now()
    lastActivityRef.current = start
    writeShared(start)
    let lastWrite = start
    const markActivity = () => {
      const now = Date.now()
      lastActivityRef.current = now
      if (now - lastWrite < ACTIVITY_THROTTLE_MS) return
      lastWrite = now
      writeShared(now)
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
      // 'local': signs out this browser (every tab shares its cookies) without
      // ending the person's sessions on their other devices.
      await signOutOfHousepost('local')
      // Go to sign-in whatever happened, so the signed-in view isn't left open
      // on an unattended screen. A full load drops everything held in memory.
      window.location.assign('/login')
    }

    const interval = setInterval(() => {
      const last = Math.max(lastActivityRef.current, readShared())
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        void logout()
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      for (const evt of events) {
        document.removeEventListener(evt, markActivity, { capture: true } as EventListenerOptions)
      }
    }
  }, [])

  return null
}
