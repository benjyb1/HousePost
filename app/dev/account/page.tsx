import { notFound } from 'next/navigation'
import { LeaveGuardProvider } from '@/components/layout/LeaveGuardProvider'
import { AccountView } from '@/components/portal/account/AccountView'
import type { AccountData } from '@/components/portal/account/types'

// Dev-only fixture: the Account page with example data and no sign-in, for
// screenshots. 404s in production. ?plan=none shows someone without a
// subscription, ?plan=overdue someone whose card payment failed. Buttons still call the real API routes, which answer 401 here,
// so the error states can be checked too.

const SUBSCRIBED: AccountData = {
  email: 'sophie@example.com',
  fullName: 'Sophie Hart',
  companyName: 'Hart & Co Interiors',
  officePostcode: 'GU7 1AA',
  emailNotifications: true,
  subscriptionStatus: 'active',
  subscriptionPeriodEnd: '2026-12-01T09:00:00Z',
  hasSubscription: true,
}

const OVERDUE: AccountData = { ...SUBSCRIBED, subscriptionStatus: 'past_due' }

const NOT_SUBSCRIBED: AccountData = {
  ...SUBSCRIBED,
  companyName: null,
  emailNotifications: false,
  subscriptionStatus: 'incomplete',
  subscriptionPeriodEnd: null,
  hasSubscription: false,
}

export default async function DevAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { plan } = await searchParams

  return (
    <div className="min-h-screen bg-paper text-ink">
      <LeaveGuardProvider>
        <AccountView data={plan === 'none' ? NOT_SUBSCRIBED : plan === 'overdue' ? OVERDUE : SUBSCRIBED} note="Example data" />
      </LeaveGuardProvider>
    </div>
  )
}
