export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountView } from '@/components/portal/account/AccountView'

// Account now holds what Settings used to (name, business, office postcode,
// emails) as well as billing, password and account deletion. Lead preferences
// moved to the Home filter bar.
export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name, office_postcode, email_notifications, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single()

  return (
    <AccountView
      data={{
        email: user.email ?? null,
        fullName: (profile?.full_name as string | null) ?? '',
        companyName: (profile?.company_name as string | null) ?? null,
        officePostcode: (profile?.office_postcode as string | null) ?? '',
        // Opted in unless explicitly off, matching the column default.
        emailNotifications: profile?.email_notifications !== false,
        subscriptionStatus: (profile?.subscription_status as string | null) ?? 'incomplete',
        subscriptionPeriodEnd: (profile?.subscription_period_end as string | null) ?? null,
      }}
    />
  )
}
