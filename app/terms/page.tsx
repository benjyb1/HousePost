import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SiteFooter } from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Terms of Service | Housepost',
  description:
    'The terms for using Housepost: your subscription, sending postcards, payments, cancellations and refunds, and how we use the service.',
}

export default function TermsPage() {
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
            Terms of service
          </h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: September 2026</p>

          {/* Draft banner — legal copy is not yet final. */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            <strong>Draft &mdash; pending final review.</strong> These terms are a
            working draft and are awaiting review by the business owner and their
            solicitor before go-live.
          </div>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">1. Who we are</h2>
              <p className="mt-2">
                Housepost is a service that finds recently sold homes near you and
                posts your postcards to the new owners. These terms are an agreement
                between you and Housepost. You can contact us at{' '}
                <a className="font-medium text-brand underline" href="mailto:info@housepost.co.uk">
                  info@housepost.co.uk
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">2. Using Housepost</h2>
              <p className="mt-2">
                By creating an account you agree to these terms and to our{' '}
                <Link className="font-medium text-brand underline" href="/privacy">
                  privacy notice
                </Link>
                . You must be 18 or over and be using Housepost for your business.
                Keep your login details safe. You are responsible for what happens
                under your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                3. The service and your subscription
              </h2>
              <p className="mt-2">
                Housepost costs £15 a month, charged to the card you give us. Each
                month includes 5 postcards. Any postcard beyond those 5 costs £1.50,
                charged when you confirm the order. There is a hard limit of 50
                postcards a month. Your allowance resets each billing period and
                unused postcards do not carry over.
              </p>
              <p className="mt-2">
                The leads we show come from HM Land Registry price paid data. We
                do our best to keep them accurate and up to date, but we do not
                promise that every sale will appear or that every address will be
                complete.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                4. Sending postcards
              </h2>
              <p className="mt-2">
                You choose which leads to send to and which design to use. Once you
                confirm an order it is held for 15 minutes before it goes to print.
                You can cancel it in that time from the Postcards page and you will
                not be charged, and any allowance used is given back. After 15
                minutes the postcard is printed and posted and can no longer be
                cancelled.
              </p>
              <p className="mt-2">
                We print and post through third-party providers and Royal Mail. We
                cannot guarantee a delivery date, and we are not responsible for
                delays or losses in the post.
              </p>
              <p className="mt-2">
                If a postcard fails to print or post, we refund any charge for it,
                give the allowance back and return the lead to your new leads.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                5. Your designs and what you send
              </h2>
              <p className="mt-2">
                You are responsible for the content of your postcards. You confirm
                that you own or have permission to use everything in your design,
                that it is honest and legal, and that it does not mislead anyone,
                harass anyone or include anything offensive. We can refuse or stop
                any postcard that breaks this, and suspend an account that keeps
                doing so.
              </p>
              <p className="mt-2">
                Your postcards are marketing to people you have not spoken to
                before. You must follow the law that applies to you and your trade.
                Every postcard carries a link to our opt-out page. When someone
                opts out we stop mailing them and you must not contact them about
                the same thing by other means.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                6. Cancelling and refunds
              </h2>
              <p className="mt-2">
                You can cancel your subscription at any time from the billing
                section of your account. It stays active until the end of the
                period you have paid for, and we do not refund part months. Postcards
                already printed and posted are not refundable, except where section
                4 says otherwise.
              </p>
              <p className="mt-2">
                If you think you have been charged in error, email us and we will
                look into it. Nothing in these terms affects your legal rights as a
                consumer where they apply.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                7. Payments
              </h2>
              <p className="mt-2">
                Payments are taken by Stripe. We do not see or store your full card
                number. If a payment fails we may pause your account until it is
                sorted out. We will tell you before we change the price and you can
                cancel before the change applies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                8. Our responsibility to you
              </h2>
              <p className="mt-2">
                We will look after the service with reasonable care and skill. We
                cannot promise it will always be available or error free, and we
                cannot promise any number of enquiries or jobs from your postcards.
              </p>
              <p className="mt-2">
                We are not liable for lost profit, lost business or indirect loss.
                Our total liability to you for any claim is limited to the amount
                you paid us in the 12 months before it. Nothing here limits
                liability that cannot be limited by law, such as for death or
                personal injury caused by negligence, or for fraud.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                9. Ending the agreement
              </h2>
              <p className="mt-2">
                We can suspend or close your account if you break these terms or
                misuse the service. We will tell you why where we can.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                10. Changes and the law
              </h2>
              <p className="mt-2">
                We may update these terms. If a change matters, we will tell you by
                email before it takes effect. If you keep using Housepost after that
                you accept the new terms. These terms are governed by the law of
                England and Wales and its courts.
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
