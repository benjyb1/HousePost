import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SiteFooter } from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Privacy Notice | Housepost',
  description:
    'How Housepost uses personal data from HM Land Registry public records for postal marketing, the legal basis, and how to object.',
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Nav ── */}
      <nav className="border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo-wordmark.png"
              alt="Housepost"
              width={600}
              height={150}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Privacy notice
          </h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: September 2026</p>

          {/* Draft banner — legal copy is not yet final. */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            <strong>Draft &mdash; pending final review.</strong> This notice is a
            working draft and is awaiting final review and approval by the business
            owner and their solicitor before go-live. It should not yet be relied
            upon as the definitive statement of our data-protection practices.
          </div>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Who we are</h2>
              <p className="mt-2">
                Housepost provides a postal marketing service for local tradespeople.
                For the purposes of UK data-protection law, Housepost is the data
                controller for the personal data described below. You can contact us
                at{' '}
                <a className="font-medium text-brand underline" href="mailto:info@housepost.co.uk">
                  info@housepost.co.uk
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                What data we process
              </h2>
              <p className="mt-2">
                We process the name and postal address associated with recent
                residential property sales. This information is taken from the{' '}
                <strong>HM Land Registry Price Paid Data</strong>, which is published
                as open, public record under the Open Government Licence. We do not
                collect special-category data, and we do not process telephone
                numbers or email addresses obtained from these records.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                Why we process it
              </h2>
              <p className="mt-2">
                We use the address to send postal marketing on behalf of local
                tradespeople &mdash; for example builders, decorators, plumbers and
                electricians &mdash; who offer services relevant to people who have
                recently moved home. Marketing is delivered by post only.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Our legal basis</h2>
              <p className="mt-2">
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
              <h2 className="text-lg font-semibold text-slate-900">Your right to object</h2>
              <p className="mt-2">
                You have the right to object to this processing at any time. If you do,
                we will stop sending postal marketing to your address and add it to our
                suppression (do-not-contact) list.
              </p>
              <p className="mt-2">
                The easiest way to opt out is to use our{' '}
                <Link href="/opt-out" className="font-medium text-brand underline">
                  opt-out page
                </Link>
                . You can also object by emailing{' '}
                <a className="font-medium text-brand underline" href="mailto:info@housepost.co.uk">
                  info@housepost.co.uk
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                How long we keep it
              </h2>
              <p className="mt-2">
                We retain address data only for as long as it is needed for the
                marketing purpose described above. Where you have opted out, we keep a
                minimal record of your address on our suppression list so that we can
                continue to honour your request and avoid contacting you again.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Your other rights</h2>
              <p className="mt-2">
                Subject to the conditions in UK data-protection law, you also have the
                right to access the personal data we hold about you, to have
                inaccurate data corrected, and to request erasure. To exercise any of
                these rights, contact{' '}
                <a className="font-medium text-brand underline" href="mailto:info@housepost.co.uk">
                  info@housepost.co.uk
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">Complaints</h2>
              <p className="mt-2">
                If you are unhappy with how we have handled your personal data, you
                have the right to complain to the Information Commissioner&rsquo;s
                Office (ICO) at{' '}
                <a
                  className="font-medium text-brand underline"
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
