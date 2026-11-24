import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicNav } from '@/components/layout/PublicNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import styles from '@/components/layout/public.module.css'
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

const CONTENTS = [
  { id: 'how', label: 'How Housepost works' },
  { id: 'statuses', label: 'What the statuses mean' },
  { id: 'problems', label: 'When something goes wrong' },
  { id: 'cancel', label: 'Cancelling and refunds' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'design', label: 'Your postcard design' },
  { id: 'optout', label: 'Do-not-mail requests' },
  { id: 'contact', label: 'Contact' },
]

const JOURNEY: { name: string; meaning: string }[] = [
  { name: 'Scheduled', meaning: `Queued behind the ${POSTCARD_COOL_OFF_MINUTES}-minute cool-off. You can still cancel for a full refund.` },
  { name: 'Sending', meaning: 'Being handed to print. This takes a moment.' },
  { name: 'Received', meaning: 'Accepted for printing.' },
  { name: 'Printing', meaning: 'On the press.' },
  { name: 'Printed', meaning: 'Printed and waiting to be posted.' },
  { name: 'Dispatched', meaning: 'In the post. Most cards arrive within two to three working days.' },
  { name: 'At delivery office', meaning: 'At the local delivery office, ready to go out.' },
  {
    name: 'Delivered',
    meaning:
      'Delivered, going by standard postal delivery times. The post does not scan every card at the door, so treat this as a good estimate rather than a signature.',
  },
]

export default function HelpPage() {
  const overage = `£${(POSTCARD_OVERAGE_PENCE / 100).toFixed(2)}`

  return (
    <div className={styles.shell}>
      <PublicNav variant="help" />

      <main className={styles.main}>
        <div className={styles.doc}>
          <header className={styles.rail}>
            <h1 className={styles.title}>Help</h1>
            <p className={styles.meta}>
              Short answers to the questions people actually ask. If yours is not here, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and a person will reply.
            </p>

            <nav aria-label="On this page">
              <ul className={styles.toc}>
                {CONTENTS.map((c) => (
                  <li key={c.id}><a href={`#${c.id}`}>{c.label}</a></li>
                ))}
              </ul>
            </nav>
          </header>

          <div className={styles.prose}>
            <section id="how">
              <h2>How Housepost works</h2>
              <p>
                On the 6th of each month we pull the latest completed sales from HM Land Registry near your office and
                list them as leads. You pick the ones you want, we print your postcard and post it to the new owner.
                That is the whole product: recently sold homes, a card through the door, your name on it.
              </p>
            </section>

            <section id="statuses">
              <h2>What the statuses mean</h2>
              <p>Every card on the Tracking page moves through these in order:</p>
              <ol className={styles.steps}>
                {JOURNEY.map((s) => (
                  <li key={s.name}>
                    <b>{s.name}</b>
                    <span>{s.meaning}</span>
                  </li>
                ))}
              </ol>
              <p>
                You get a notification when cards are dispatched and when they are delivered, grouped so a batch of
                twelve is one message, not twelve. If the post cannot deliver a card it shows as <strong>Returned</strong>,
                usually because the address is incomplete or no longer in use, and we email you about it.
              </p>
            </section>

            <section id="problems">
              <h2>When something goes wrong</h2>
              <p>Two other statuses can appear. They mean different things, and the Tracking page tells you which.</p>
              <div className={styles.cases}>
                <div className={styles.panel}>
                  <p className={styles.caseName}>Delayed</p>
                  <p>
                    A temporary problem on our side, usually the print service being unavailable. Your card stays queued
                    and is sent automatically once it clears, normally within the hour. You are not charged anything
                    extra, and you can still cancel it for a full refund while it is queued. You get one email when a
                    batch is first delayed. Nothing for you to do.
                  </p>
                </div>
                <div className={styles.panel}>
                  <p className={`${styles.caseName} ${styles.problem}`}>Failed</p>
                  <p>
                    The card could not be printed for a reason specific to it, most often the address or the design.
                    It has <em>not</em> been sent. Any charge for it is refunded to your card within a few days and the
                    lead goes back into your list. You get one email per batch with the reasons, and &ldquo;What do
                    these mean?&rdquo; on Tracking lists the usual ones. Fix the cause, then send again.
                  </p>
                </div>
              </div>
              <p>
                Whatever the cause, our team is alerted at the same moment you are. If a card has been delayed for more
                than a day, or something looks wrong that this page does not explain, email us with the address and we
                will sort it.
              </p>
            </section>

            <section id="cancel">
              <h2>Cancelling and refunds</h2>
              <p>
                Every order is held for {POSTCARD_COOL_OFF_MINUTES} minutes before it goes to print. During that window
                the Tracking page shows a <strong>Cancel order</strong> button. Cancelling refunds any charge for that
                order in full and returns the leads to your list. Once a card shows Sending or later it is on its way and
                cannot be recalled.
              </p>
            </section>

            <section id="pricing">
              <h2>Pricing</h2>
              <p>
                Your subscription includes <strong>{INCLUDED_POSTCARDS_PER_MONTH} postcards a month</strong>. Cards beyond
                that are <strong>{overage} each</strong>, charged to your saved card when you confirm the order and shown
                to you before you confirm. There is a hard limit of {MONTHLY_POSTCARD_CAP} cards per billing period as a
                spend safeguard. Unused included cards do not roll over. Manage your plan and card under Account.
              </p>
            </section>

            <section id="design">
              <h2>Your postcard design</h2>
              <p>
                Upload your own artwork or start from a template under Designs. The front is yours edge to edge.
                On the back, the right half is reserved for the address and postage, so keep your message and logo in
                the left half. Use the <strong>Preview exact printed postcard</strong> button to see precisely what will
                land on the doormat before you send anything.
              </p>
            </section>

            <section id="optout">
              <h2>Do-not-mail requests</h2>
              <p>
                Anyone can ask not to receive post from Housepost customers at{' '}
                <Link href="/opt-out">housepost.co.uk/opt-out</Link>. Those
                addresses are removed from everyone&rsquo;s leads and blocked at send time, so you never pay for a card
                to someone who has opted out. Our <Link href="/privacy">privacy notice</Link>{' '}
                explains the data we use and why.
              </p>
            </section>

            <section id="contact">
              <h2>Contact</h2>
              <p>
                Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
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
