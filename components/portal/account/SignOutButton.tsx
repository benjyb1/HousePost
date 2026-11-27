'use client'

import { toast } from 'sonner'
import { signOutOfHousepost } from '@/lib/auth/sign-out'
import { useLeaveGuard } from '@/components/layout/LeaveGuardProvider'
import chrome from '@/components/portal/page-chrome.module.css'

/** Sign out, held by the portal leave-guard like the top bar's Sign out. */
export function SignOutButton() {
  const { guard } = useLeaveGuard()

  async function signOut() {
    if ((await signOutOfHousepost()) === 'failed') {
      toast.error('We couldn’t sign you out. Check your connection and try again.')
      return
    }
    // A full page load, so nothing from the signed-in session stays in memory.
    window.location.assign('/login')
  }

  return (
    <button type="button" className={`${chrome.btn} ${chrome.btnGhost}`} onClick={() => guard(signOut)}>
      Sign out
    </button>
  )
}
