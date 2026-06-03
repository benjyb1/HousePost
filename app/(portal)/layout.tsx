export const dynamic = 'force-dynamic'

import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner'
import { SiteFooter } from '@/components/layout/SiteFooter'

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
            overlaps the page title underneath it. The logo matches the size of
            the one in the sidebar (h-8), so the bar is a touch taller (h-16). */}
        <div className="flex h-16 shrink-0 items-center justify-center border-b bg-white md:hidden">
          <Image
            src="/logo-wordmark.png"
            alt="Housepost"
            width={400}
            height={100}
            className="h-8 w-auto"
          />
        </div>
        <SubscriptionBanner status={status} />
        <main className="flex-1 overflow-y-auto">
          {/* min-h-full + flex column keeps the footer pinned to the bottom even
              on short pages, instead of floating up into the middle. */}
          <div className="flex min-h-full flex-col">
            <div className="flex-1 p-4 pb-8 sm:p-6">{children}</div>
            <SiteFooter variant="portal" />
          </div>
        </main>
      </div>
    </div>
  )
}
