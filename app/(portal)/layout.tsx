export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { IdleLogout } from '@/components/portal/IdleLogout'
import { LeaveGuardProvider } from '@/components/layout/LeaveGuardProvider'
import { AppBar } from '@/components/portal/AppBar'

function initialsFrom(name: string | null | undefined, email: string | null | undefined) {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)
  return letters.toUpperCase() || 'HP'
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from('profiles').select('subscription_status, company_name, full_name').eq('id', user.id).single(),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
  ])

  const status = (profile?.subscription_status as string) ?? 'incomplete'
  const initials = initialsFrom((profile?.company_name as string) || (profile?.full_name as string), user.email)

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Auto sign-out after 30 minutes of inactivity (feature 6.2). */}
      <IdleLogout />
      {/* Portal-wide unsaved-changes guard: covers the top bar (Sign out, nav
          links), the browser Back button and tab close/reload. It only acts
          while a page reports unsaved edits. */}
      <LeaveGuardProvider>
        <AppBar initials={initials} unread={(unreadCount ?? 0) > 0} />
        <SubscriptionBanner status={status} />
        <main className="flex-1">{children}</main>
        <SiteFooter variant="portal" />
      </LeaveGuardProvider>
    </div>
  )
}
