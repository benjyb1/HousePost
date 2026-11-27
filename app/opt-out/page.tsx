import type { Metadata } from 'next'
import { PublicNav } from '@/components/layout/PublicNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import styles from '@/components/layout/public.module.css'
import { OptOutForm } from './OptOutForm'

export const metadata: Metadata = {
  title: 'Opt out of postal marketing',
  description:
    'Tell us your address and we will add it to our do-not-contact list, so you get no more postcards from Housepost customers.',
  alternates: { canonical: '/opt-out' },
}

// Public page: no authentication required. The form (and its call to
// /api/opt-out) lives in OptOutForm; the words about where the address came
// from are compliance copy, so keep them as they are.
export default function OptOutPage() {
  return (
    <div className={styles.shell}>
      <PublicNav />

      <main className={styles.main}>
        {/* One column, so "the address below" stays true at every width. */}
        <div className={styles.stack}>
          <header>
            <h1 className={styles.title}>
              Rather not receive our postcards? No problem.
            </h1>
            <p className={styles.lede}>
              Your address came from HM Land Registry&rsquo;s public record of property
              sales. If you&rsquo;d prefer we didn&rsquo;t post marketing to your home,
              just tell us the address below and we&rsquo;ll add it to our
              do-not-contact list. It only takes a moment.
            </p>
          </header>

          <div>
            <OptOutForm />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
