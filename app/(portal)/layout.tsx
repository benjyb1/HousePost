export const dynamic = 'force-dynamic'

import Image from 'next/image'
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
        {/* Mobile top bar — leaves room for the fixed hamburger so it no longer
            overlaps the page title underneath it. */}
        <div className="flex h-14 shrink-0 items-center justify-center border-b bg-white md:hidden">
          <Image
            src="/logo-wordmark.png"
            alt="Housepost"
            width={400}
            height={100}
            className="h-7 w-auto"
          />
        </div>
        <SubscriptionBanner status={status} />
        <main className="flex-1 overflow-y-auto p-4 pb-8 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
