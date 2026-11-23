export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { Hanken_Grotesk } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { IdleLogout } from '@/components/portal/IdleLogout'
import { LeaveGuardProvider } from '@/components/layout/LeaveGuardProvider'
import { AppBar } from '@/components/portal/AppBar'
import styles from '@/components/portal/portal.module.css'

// Paper's typeface, shared with the homepage.
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-portal' }) // variable font (fixed weights break the Vercel build)

function initialsOf(name: string | null | undefined, email: string | null | undefined) {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)
  return letters.toUpperCase() || 'HP'
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count: unread }] = await Promise.all([
    supabase.from('profiles').select('subscription_status, full_name').eq('id', user.id).single(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false),
  ])

  const status = (profile?.subscription_status as string) ?? 'incomplete'

  return (
    <div className={`${sans.variable} ${sans.className} ${styles.portal}`}>
      {/* Auto sign-out after 30 minutes of inactivity (feature 6.2). */}
      <IdleLogout />
      {/* Portal-wide unsaved-changes guard: covers the top bar (sign-out, nav
          links), the browser Back button and tab close/reload. It only acts
          while a page reports unsaved edits. */}
      <LeaveGuardProvider>
        <AppBar initials={initialsOf(profile?.full_name as string | null, user.email)} unread={unread ?? 0} />
        <SubscriptionBanner status={status} />
        <main className={styles.content}>{children}</main>
        <SiteFooter variant="portal" />
      </LeaveGuardProvider>
    </div>
  )
}
