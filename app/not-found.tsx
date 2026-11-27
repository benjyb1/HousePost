import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicNav } from '@/components/layout/PublicNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import styles from '@/components/layout/public.module.css'

// Our own 404. Next's built-in one prints a second <title> into the page on
// top of the layout's, so search engines and tabs saw two. Next adds the
// noindex tag to 404s itself, so it isn't repeated here. No canonical: the
// layout's './' would point it at /_not-found.
export const metadata: Metadata = {
  title: { absolute: 'Page not found | Housepost' },
  alternates: { canonical: null },
}

export default function NotFound() {
  return (
    <div className={styles.shell}>
      <PublicNav />

      <main className={styles.main}>
        <div className={styles.stack}>
          <header>
            <h1 className={styles.title}>We can&rsquo;t find that page.</h1>
            <p className={styles.lede}>
              The link may be old, or the address may have a typo in it. Start again from the homepage.
            </p>
          </header>
          <div>
            <Link href="/" className={cn(buttonVariants({ size: 'lg' }), 'h-[52px] px-7 text-[15px]')}>
              Go to the homepage
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
