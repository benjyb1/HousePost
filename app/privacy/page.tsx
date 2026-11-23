import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicNav } from '@/components/layout/PublicNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import styles from '@/components/layout/public.module.css'

export const metadata: Metadata = {
  title: 'Privacy Notice | Housepost',
  description:
    'How Housepost uses personal data from HM Land Registry public records for postal marketing, the legal basis, and how to object.',
}

// The wording below is legal copy. Restyle freely, but change none of the words.
export default function PrivacyPage() {
  return (
    <div className={styles.shell}>
      <PublicNav />

      <main className={styles.main}>
        <div className={styles.doc}>
          <header className={styles.rail}>
            <h1 className={styles.title}>
              Privacy notice
            </h1>
            <p className={styles.meta}>Last updated: September 2026</p>
          </header>

          <div className={styles.prose}>
            {/* Draft banner — legal copy is not yet final. */}
            <div className={styles.aside}>
              <strong>Draft, pending final review.</strong> This notice is a
              working draft and is awaiting final review and approval by the business
              owner and their solicitor before go-live. It should not yet be relied
              upon as the definitive statement of our data-protection practices.
            </div>

            <section>
              <h2>Who we are</h2>
              <p>
                Housepost provides a postal marketing service for local tradespeople.
                For the purposes of UK data-protection law, Housepost is the data
                controller for the personal data described below. You can contact us
                at{' '}
                <a href="mailto:info@housepost.co.uk">
                  info@housepost.co.uk
                </a>
                .
              </p>
            </section>

            <section>
              <h2>
                What data we process
              </h2>
              <p>
                We process the name and postal address associated with recent
                residential property sales. This information is taken from the{' '}
                <strong>HM Land Registry Price Paid Data</strong>, which is published
                as open, public record under the Open Government Licence. We do not
                collect special-category data, and we do not process telephone
                numbers or email addresses obtained from these records.
              </p>
            </section>

            <section>
              <h2>
                Why we process it
              </h2>
              <p>
                We use the address to send postal marketing on behalf of local
                tradespeople (for example builders, decorators, plumbers and
                electricians) who offer services relevant to people who have
                recently moved home. Marketing is delivered by post only.
              </p>
            </section>

            <section>
              <h2>Our legal basis</h2>
              <p>
                Our legal basis for processing this data is{' '}
                <strong>legitimate interests</strong> (Article 6(1)(f) UK GDPR). Our
                legitimate interest is to promote relevant local services to new
                homeowners by post. We have considered your rights and freedoms and
                believe that occasional, clearly identified postal marketing, which
                you can stop at any time, does not override them. You can ask us for
                more detail about this assessment.
              </p>
            </section>

            <section>
              <h2>Your right to object</h2>
              <p>
                You have the right to object to this processing at any time. If you do,
                we will stop sending postal marketing to your address and add it to our
                suppression (do-not-contact) list.
              </p>
              <p>
                The easiest way to opt out is to use our{' '}
                <Link href="/opt-out">
                  opt-out page
                </Link>
                . You can also object by emailing{' '}
                <a href="mailto:info@housepost.co.uk">
                  info@housepost.co.uk
                </a>
                .
              </p>
            </section>

            <section>
              <h2>
                How long we keep it
              </h2>
              <p>
                We retain address data only for as long as it is needed for the
                marketing purpose described above. Where you have opted out, we keep a
                minimal record of your address on our suppression list so that we can
                continue to honour your request and avoid contacting you again.
              </p>
            </section>

            <section>
              <h2>Your other rights</h2>
              <p>
                Subject to the conditions in UK data-protection law, you also have the
                right to access the personal data we hold about you, to have
                inaccurate data corrected, and to request erasure. To exercise any of
                these rights, contact{' '}
                <a href="mailto:info@housepost.co.uk">
                  info@housepost.co.uk
                </a>
                .
              </p>
            </section>

            <section>
              <h2>Complaints</h2>
              <p>
                If you are unhappy with how we have handled your personal data, you
                have the right to complain to the Information Commissioner&rsquo;s
                Office (ICO) at{' '}
                <a
                  href="https://ico.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ico.org.uk
                </a>
                . We would, however, appreciate the chance to address your concerns
                first.
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
