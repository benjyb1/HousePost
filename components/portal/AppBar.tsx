'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLeaveGuard } from '@/components/layout/LeaveGuardProvider'
import { Logo } from '@/components/marketing/home/Logo'
import styles from './portal.module.css'

/*
  Paper's top bar, in place of the old sidebar: the four places people go
  (Home, Designs, Tracking, Account), the notifications bell and the avatar
  menu for everything else. Sign-out goes through the unsaved-changes guard,
  as it did in the sidebar.
*/

const NAV = [
  { href: '/dashboard', label: 'Home' },
  { href: '/postcards/design', label: 'Designs' },
  { href: '/postcards', label: 'Tracking' },
  { href: '/account', label: 'Account' },
]

function isCurrent(pathname: string, href: string) {
  if (href === '/postcards') return pathname === '/postcards'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppBar({ initials, unread }: { initials: string; unread: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const { guard } = useLeaveGuard()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className={styles.bar}>
      <div className={styles.barIn}>
        <Link href="/dashboard" className={styles.brand} aria-label="Housepost home">
          <Logo />
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.barEnd} ref={menuRef}>
          <Link href="/notifications" className={styles.iconBtn} aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unread > 0 && <span className={styles.dot} />}
          </Link>
          <button
            type="button"
            className={styles.avatar}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Your account menu"
            onClick={() => setOpen((v) => !v)}
          >
            {initials}
          </button>
          {open && (
            <div className={styles.menu} role="menu">
              <Link role="menuitem" href="/leads" onClick={() => setOpen(false)}>
                All homes
              </Link>
              <Link role="menuitem" href="/settings" onClick={() => setOpen(false)}>
                Settings
              </Link>
              <Link role="menuitem" href="/help" onClick={() => setOpen(false)}>
                Help
              </Link>
              <div className={styles.menuSep} />
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  guard(signOut)
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
