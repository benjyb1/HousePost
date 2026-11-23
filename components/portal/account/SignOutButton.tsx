'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLeaveGuard } from '@/components/layout/LeaveGuardProvider'
import chrome from '@/components/portal/page-chrome.module.css'

/** Sign out, held by the portal leave-guard like the top bar's Sign out. */
export function SignOutButton() {
  const router = useRouter()
  const { guard } = useLeaveGuard()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button type="button" className={`${chrome.btn} ${chrome.btnGhost}`} onClick={() => guard(signOut)}>
      Sign out
    </button>
  )
}
