import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import styles from './public.module.css'

/**
 * Top bar for the public pages, matching the homepage's. Help is mostly read
 * by signed-in customers (it's in their account menu), so it offers a way back
 * to the app instead of Log in / Sign up.
 */
export function PublicNav({ variant = 'public' }: { variant?: 'public' | 'help' }) {
  return (
    <nav className={styles.nav} aria-label="Main">
      <Link href="/" aria-label="Housepost home"><Logo /></Link>
      <div className={styles.navLinks}>
        {variant === 'help' ? (
          <Link href="/dashboard">Back to the app</Link>
        ) : (
          <>
            <Link href="/login">Log in</Link>
            <Link className={styles.navBtn} href="/signup">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  )
}
