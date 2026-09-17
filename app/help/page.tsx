import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SiteFooter } from '@/components/layout/SiteFooter'
import {
  INCLUDED_POSTCARDS_PER_MONTH,
  POSTCARD_OVERAGE_PENCE,
  MONTHLY_POSTCARD_CAP,
  POSTCARD_COOL_OFF_MINUTES,
} from '@/types/profile'

export const metadata: Metadata = {
  title: 'Help | Housepost',
  description:
    'How Housepost works, what each postcard status means, what happens when a card is delayed or fails, pricing, and how to get in touch.',
}

const SUPPORT_EMAIL = 'info@housepost.co.uk'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
}

export default function HelpPage() {
  const overage = `£${(POSTCARD_OVERAGE_PENCE / 100).toFixed(2)}`

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Image src="/logo-wordmark.png" alt="Housepost" width={600} height={150} className="h-8 w-auto sm:h-9" priority />
          </Link>
          <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Go to my dashboard
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Help</h1>
          <p className="mt-3 text-slate-500">
            Short answers to the questions people actually ask. If yours is not here, email{' '}
            <a className="font-medium text-brand underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
            and a person will reply.
          </p>

          <nav aria-label="On this page" className="mt-8 rounded-xl border bg-slate-50 p-4 text-sm">
            <ul className="grid gap-1 sm:grid-cols-2">
              <li><a className="text-brand hover:underline" href="#how">How Housepost works</a></li>
              <li><a className="text-brand hover:underline" href="#statuses">What the statuses mean</a></li>
              <li><a className="text-brand hover:underline" href="#problems">When something goes wrong</a></li>
              <li><a className="text-brand hover:underline" href="#cancel">Cancelling and refunds</a></li>
              <li><a className="text-brand hover:underline" href="#pricing">Pricing</a></li>
              <li><a className="text-brand hover:underline" href="#design">Your postcard design</a></li>
              <li><a className="text-brand hover:underline" href="#optout">Do-not-mail requests</a></li>
              <li><a className="text-brand hover:underline" href="#contact">Contact</a></li>
            </ul>
          </nav>

          <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-slate-700">
            <section id="how">
              <H2>How Housepost works</H2>
              <p className="mt-2">
                On the 6th of each month we pull the latest completed sales from HM Land Registry near your office and
                list them as leads. You pick the ones you want, we print your postcard and post it to the new owner.
                That is the whole product: recently sold homes, a card through the door, your name on it.
              </p>
            </section>

            <section id="statuses">
              <H2>What the statuses mean</H2>
              <p className="mt-2">Every card on the Tracking page moves through these in order:</p>
              <ol className="mt-3 space-y-2">
                <li><strong>Scheduled.</strong> Queued behind the {POSTCARD_COOL_OFF_MINUTES}-minute cool-off. You can still cancel for a full refund.</li>
                <li><strong>Sending.</strong> Being handed to print. This takes a moment.</li>
                <li><strong>Received.</strong> Accepted for printing.</li>
                <li><strong>Printing.</strong> On the press.</li>
                <li><strong>Printed.</strong> Printed and waiting to be posted.</li>
                <li><strong>Dispatched.</strong> Handed to Royal Mail. Second-class post usually arrives in two to three working days. We do not get a delivery scan for standard post, so Dispatched is the last status you will normally see.</li>
              </ol>
            </section>

            <section id="problems">
              <H2>When something goes wrong</H2>
              <p className="mt-2">Two other statuses can appear. They mean different things, and the Tracking page tells you which.</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">Delayed</p>
                  <p className="mt-1 text-amber-900">
                    A temporary problem on our side, usually the print service being unavailable. Your card stays queued
                    and is sent automatically once it clears, normally within the hour. You are not charged anything
                    extra, and you can still cancel it for a full refund while it is queued. You get one email when a
                    batch is first delayed. Nothing for you to do.
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="font-semibold text-red-900">Failed</p>
                  <p className="mt-1 text-red-900">
                    The card could not be printed for a reason specific to it, most often the address or the design.
                    It has <em>not</em> been sent. Any charge for it is refunded to your card within a few days, the
                    lead goes back into your list, and the reason is shown under the status. Fix the cause, then send
                    again. You get one email per batch with the reasons.
                  </p>
                </div>
              </div>
              <p className="mt-4">
                Whatever the cause, our team is alerted at the same moment you are. If a card has been delayed for more
                than a day, or something looks wrong that this page does not explain, email us with the address and we
                will sort it.
              </p>
            </section>

            <section id="cancel">
              <H2>Cancelling and refunds</H2>
              <p className="mt-2">
                Every order is held for {POSTCARD_COOL_OFF_MINUTES} minutes before it goes to print. During that window
                the Tracking page shows a <strong>Cancel order</strong> button. Cancelling refunds any charge for that
                order in full and returns the leads to your list. Once a card shows Sending or later it is on its way and
                cannot be recalled.
              </p>
            </section>

            <section id="pricing">
              <H2>Pricing</H2>
              <p className="mt-2">
                Your subscription includes <strong>{INCLUDED_POSTCARDS_PER_MONTH} postcards a month</strong>. Cards beyond
                that are <strong>{overage} each</strong>, charged to your saved card when you confirm the order and shown
                to you before you confirm. There is a hard limit of {MONTHLY_POSTCARD_CAP} cards per billing period as a
                spend safeguard. Unused included cards do not roll over. Manage your plan and card under Billing.
              </p>
            </section>

            <section id="design">
              <H2>Your postcard design</H2>
              <p className="mt-2">
                Upload your own artwork or start from a template under Postcard Design. The front is yours edge to edge.
                On the back, the right half is reserved for the address and postage, so keep your message and logo in
                the left half. Use the <strong>Preview exact printed postcard</strong> button to see precisely what will
                land on the doormat before you send anything.
              </p>
            </section>

            <section id="optout">
              <H2>Do-not-mail requests</H2>
              <p className="mt-2">
                Anyone can ask not to receive post from Housepost customers at{' '}
                <Link href="/opt-out" className="font-medium text-brand underline">housepost.co.uk/opt-out</Link>. Those
                addresses are removed from everyone&rsquo;s leads and blocked at send time, so you never pay for a card
                to someone who has opted out. Our <Link href="/privacy" className="font-medium text-brand underline">privacy notice</Link>{' '}
                explains the data we use and why.
              </p>
            </section>

            <section id="contact">
              <H2>Contact</H2>
              <p className="mt-2">
                Email <a className="font-medium text-brand underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                Include the address on the card if it is about a specific postcard. We aim to reply the same working day.
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter variant="public" />
    </div>
  )
}
