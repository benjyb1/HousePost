import Link from 'next/link'
import { LandRegistryAttribution } from '@/components/layout/LandRegistryAttribution'
import styles from './public.module.css'

const footLink = '-my-2.5 inline-flex min-h-10 items-center hover:text-ink'

/**
 * Shared site footer. Both variants carry the attribution the Price Paid Data
 * licence requires wherever we use the data. It never names who prints or
 * posts the cards.
 *
 *  - "public" (Privacy, Opt out, Help, Houses sold): the homepage's footer,
 *    so the public pages end the same way the homepage does.
 *  - "portal" (signed-in app, sign-in pages): one quiet Paper line.
 */
export function SiteFooter({ variant = 'public' }: { variant?: 'public' | 'portal' }) {
  if (variant === 'portal') {
    return (
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-6 text-[13px] text-ink-2 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <LandRegistryAttribution className="max-w-xl text-[13px] leading-relaxed text-ink-2" />
          {/* Each link is a 40px-tall tap target; the negative margin keeps the line where it was. */}
          <nav aria-label="Footer" className="flex shrink-0 flex-wrap gap-x-5 gap-y-1">
            <Link href="/help" className={footLink}>Help</Link>
            <Link href="/privacy" className={footLink}>Privacy</Link>
            <Link href="/opt-out" className={footLink}>Opt out of mail</Link>
          </nav>
        </div>
      </footer>
    )
  }

  return (
    <footer className={styles.foot}>
      <span>© 2026 Housepost</span>
      <nav aria-label="Footer">
        <Link href="/help">Help</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/opt-out">Opt out of mail</Link>
        <Link href="/login">Log in</Link>
      </nav>
      <div className={styles.lic}>
        <LandRegistryAttribution className="" />
      </div>
    </footer>
  )
}
