export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  const status = (profile?.subscription_status as string) ?? 'incomplete'

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SubscriptionBanner status={status} />
        <main className="flex-1 overflow-y-auto p-6 pb-8">
          {children}
        </main>
      </div>
    </div>
  )
}
