'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLeaveGuard } from '@/components/layout/LeaveGuardProvider'
import { Logo } from '@/components/brand/Logo'
import styles from './appbar.module.css'

const NAV = [
  { href: '/dashboard', label: 'Home', match: (p: string) => p === '/dashboard' || p === '/leads' },
  { href: '/postcards/design', label: 'Designs', match: (p: string) => p.startsWith('/postcards/design') },
  { href: '/postcards', label: 'Tracking', match: (p: string) => p === '/postcards' },
  { href: '/account', label: 'Account', match: (p: string) => p === '/account' || p === '/settings' || p === '/billing' },
]

/** Paper's top bar: logo, four sections, notifications and an account menu. */
export function AppBar({ initials, unread }: { initials: string; unread: boolean }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { guard } = useLeaveGuard()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [menu])

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className={styles.bar}>
      <div className={styles.in}>
        <Link href="/dashboard" className={styles.logo} aria-label="Housepost, Home"><Logo /></Link>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={n.match(pathname) ? 'page' : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className={styles.end}>
          <Link href="/notifications" className={styles.icon} aria-label={unread ? 'Notifications, new' : 'Notifications'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unread && <span className={styles.dot} />}
          </Link>
          <div className={styles.menuWrap} ref={menuRef}>
            <button type="button" className={styles.avatar} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label="Your account">
              {initials}
            </button>
            {menu && (
              <div className={styles.menu} role="menu">
                <Link role="menuitem" href="/account" onClick={() => setMenu(false)}>Account</Link>
                <Link role="menuitem" href="/help" onClick={() => setMenu(false)}>Help</Link>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); guard(signOut) }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
