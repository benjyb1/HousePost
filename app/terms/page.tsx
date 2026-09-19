import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SiteFooter } from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Terms of Service | Housepost',
  description:
    'The terms for using Housepost: your subscription, sending postcards, lead data, third-party suppliers, payments, cancellation and our liability.',
}

const link = 'font-medium text-brand underline'

type Section = { title: string; clauses: React.ReactNode[] }

const SECTIONS: Section[] = [
  {
    title: 'About these terms',
    clauses: [
      <>
        Housepost is operated by [LEGAL ENTITY NAME], a company registered in
        England and Wales (company number [NUMBER]) with its registered office at
        [REGISTERED ADDRESS]. You can contact us at{' '}
        <a className={link} href="mailto:info@housepost.co.uk">
          info@housepost.co.uk
        </a>
        . References to &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;Housepost&rdquo;
        mean that company.
      </>,
      <>
        These terms form the agreement between you and us for your use of the
        Housepost website and service (the &ldquo;Service&rdquo;). By creating an
        account you confirm that you have read and accept them, together with our{' '}
        <Link className={link} href="/privacy">
          privacy notice
        </Link>
        .
      </>,
      'The Service is for businesses. You confirm that you are 18 or over and that you are signing up for the purposes of your trade, business or profession, not as a consumer. If you are a consumer, nothing in these terms affects your statutory rights.',
      'If you sign up on behalf of a company, you confirm you have authority to bind it, and "you" includes that company.',
    ],
  },
  {
    title: 'The Service',
    clauses: [
      'Housepost shows you homes that have recently sold near your business address and lets you choose which new owners to send a printed postcard to. We arrange the printing and posting of the postcards you order.',
      'We will provide the Service with reasonable care and skill. We may improve, change or remove features from time to time. We will try to give you notice of any change that materially reduces what you are paying for.',
      'We do not promise that the Service will be available at all times or free of errors. We may suspend it briefly for maintenance or where we need to for security reasons.',
      'We do not promise or guarantee any result from using the Service. That includes any number of enquiries, jobs, sales or revenue. Response to direct mail varies and is outside our control.',
    ],
  },
  {
    title: 'Lead data and HM Land Registry',
    clauses: [
      'The leads we show you are based on the HM Land Registry Price Paid Data. Contains HM Land Registry data © Crown copyright and database right. This data is licensed under the Open Government Licence v3.0.',
      'We do not create that data. It is published by a government body and we rely on it as published. It may be incomplete, out of date, delayed, wrongly recorded or contain errors, and not every sale will appear. Addresses may be missing details such as a flat number or town.',
      'A lead is not a promise that a person is at the address, wants to hear from you, or is the owner. The person may have moved, died, opted out or never been the buyer. We do not verify the data, and we do not warrant that it is accurate, complete or up to date.',
      'We may remove an address at any time, for example where someone has opted out or where we think the data is wrong. Changes or gaps in the government data, or a delay or interruption to its publication, do not entitle you to a refund or compensation unless clause 5.4 applies.',
      'You may not say or imply that HM Land Registry or any government body endorses you, us or your business.',
    ],
  },
  {
    title: 'Your subscription and payments',
    clauses: [
      'The Service is a monthly subscription of £15 a month. Each billing period includes 5 postcards. A postcard beyond those 5 costs £1.50 and is charged when you confirm the order. There is a maximum of 50 postcards in each billing period. Unused postcards do not carry over.',
      'Prices are shown in pounds sterling. Where VAT applies we will show it at checkout and on your invoice.',
      'Your subscription renews automatically each month until you cancel it. We take payment in advance by card through our payment provider, Stripe. We do not see or store your full card number. You authorise us to charge your card for the subscription and for any extra postcards you order.',
      'If a payment fails we may try it again, tell you, and suspend your account until it is paid. You must keep your card details up to date.',
      'We may change our prices. We will give you at least 30 days\' notice by email, and the new price applies from your next renewal after that. If you do not agree, you can cancel before the change takes effect.',
      'You are responsible for any tax that applies to you, other than tax on our income.',
    ],
  },
  {
    title: 'Ordering and sending postcards',
    clauses: [
      'You choose the leads and the designs. When you confirm an order it is held for 15 minutes before it is sent to print. You can cancel it in that time from the Postcards page and you will not be charged, and any allowance used is given back. After that the postcard goes to print and cannot be cancelled or changed.',
      'You are responsible for your designs. We print what you approve. Please check the preview, including where the address will be printed and the margins that are trimmed. Small differences in colour, cropping and alignment between the screen and the printed card are normal and are not a fault.',
      'Housepost prints the recipient\'s address on the back of each card. You must leave the reserved address area clear.',
      'If a postcard you have ordered fails to be printed or posted because of a fault in our systems or our suppliers before it reaches the post, we will refund any charge for that postcard, give the allowance back and return the lead to your new leads. This is our full responsibility for a failed send.',
      'We may refuse, hold or cancel any postcard that we reasonably think breaks these terms or the law, and we will refund it if we do.',
    ],
  },
  {
    title: 'Third-party suppliers and delivery',
    clauses: [
      'We use other companies to provide parts of the Service, including a print and mailing provider, Royal Mail or another carrier, Stripe for payments, and hosting, database and email providers (our "Suppliers").',
      'Once a postcard has been handed to a print provider or carrier, delivery is in their hands. We do not guarantee that any postcard will be printed to a particular standard, or delivered, or delivered by a particular date, or delivered to the right person. Post can be late, lost or damaged.',
      'Suppliers set their own terms and their own limits on what they will pay if something goes wrong, and we are bound by them. We are not responsible for a Supplier\'s acts, delays, errors, outages or failures, except as set out in clause 5.4.',
      'If a postcard is lost or damaged in the post and we are able to recover compensation from a Supplier or carrier for it, we will pay you the part of that compensation that relates to your postcard. We will not be required to bring court action against a Supplier.',
      'You accept that the Service depends on Suppliers and on data and infrastructure outside our control, and that a failure by any of them may affect the Service.',
    ],
  },
  {
    title: 'Your content and marketing compliance',
    clauses: [
      'You are solely responsible for everything in your postcards, including the words, images, logos, offers and contact details, and for the way you market your business.',
      'You promise that your postcards will be accurate, honest and lawful. They must follow the UK Code of Non-broadcast Advertising and Direct & Promotional Marketing (the CAP Code), consumer protection law, and any rules that apply to your trade. They must not be misleading, offensive, defamatory, discriminatory or threatening, and must not infringe anyone\'s rights.',
      'You must be able to show that any claims you make, for example about qualifications, accreditations, insurance, prices or guarantees, are true.',
      'You must not use the Service for anything unlawful, or to send postcards that are not marketing for your own genuine business.',
      'You must respect an opt-out. Every postcard carries a link to our opt-out page. When someone opts out, we will stop posting to them, and you must not contact them about your services by any other means without their permission.',
      'We do not check or approve your content and we are not responsible for it. We may still remove or refuse it at any time.',
    ],
  },
  {
    title: 'How you may use the Service and lead data',
    clauses: [
      'You may use the leads and the Service only to send your own postcards through Housepost. You must not copy, scrape, export, store outside the Service, sell, share, rent or publish lead data, or use it to build your own mailing list or database. You must not use it for any other kind of marketing or contact.',
      'You must not copy or reverse engineer the Service, use bots or automated tools to access it, try to get around its limits or security, or interfere with how it works.',
      'You must not share your login with anyone outside your business. You are responsible for all activity on your account.',
      'You must not use the Service to harass anyone or to send unsolicited mail to someone you know does not want it.',
    ],
  },
  {
    title: 'Data protection',
    clauses: [
      <>
        We handle personal data in line with UK data protection law, as explained
        in our{' '}
        <Link className={link} href="/privacy">
          privacy notice
        </Link>
        . For the recipients&apos; details in the lead data, we decide how and why
        that data is used to provide the Service.
      </>,
      'You must not use recipients\' personal data other than as these terms allow, and you must follow data protection law in anything you do with any personal data you collect yourself, for example if a recipient contacts you.',
      'We will keep your account data, such as your name, email address and business details, to provide the Service and to meet our legal duties.',
    ],
  },
  {
    title: 'Intellectual property',
    clauses: [
      'We own the Service, the website and the lead presentation, and all rights in them. You get a limited, non-exclusive, non-transferable right to use the Service while you have an active subscription.',
      'You keep the rights in your own designs and logos. You give us and our Suppliers a licence to use, copy and print them as needed to provide the Service.',
      'You promise that you own or have permission to use everything in your designs, and that our use of them as set out here will not infringe anyone\'s rights.',
    ],
  },
  {
    title: 'Cancelling, suspension and ending the agreement',
    clauses: [
      'You can cancel your subscription at any time from the billing section of your account. It stays active until the end of the period you have paid for and then ends. We do not refund part months or unused postcards.',
      'Postcards that have already gone to print cannot be cancelled or refunded, except as set out in clause 5.4.',
      'We can suspend or close your account immediately if you seriously or repeatedly break these terms, if we reasonably suspect fraud or misuse, if a payment is overdue after we have told you, or where we must to comply with the law. Where we reasonably can, we will tell you why.',
      'We can also end the Service or your subscription for any other reason by giving you 30 days\' notice. If we do, we will refund the unused part of what you have paid for that period.',
      'When the agreement ends you lose access to the Service and any leads and designs on your account. Any rights and duties that are meant to continue, including those on liability, indemnity and the use of lead data, continue.',
    ],
  },
  {
    title: 'Our liability to you',
    clauses: [
      'Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for anything else that the law does not allow to be limited or excluded.',
      'Subject to clause 12.1, we are not liable to you, whether in contract, tort (including negligence), breach of statutory duty or otherwise, for any loss of profit, revenue, sales, contracts, business, opportunity, goodwill or anticipated savings, or for any indirect or consequential loss, however it arises.',
      'Subject to clause 12.1, our total liability to you in any 12-month period for all claims arising from or in connection with the Service and these terms is limited to the amount you paid us in the 12 months before the event that gave rise to the claim.',
      'Without limiting the above, we are not liable for any loss arising from the content, accuracy, completeness, timeliness or availability of HM Land Registry data or any other public or third-party data, including errors, omissions, delays, or changes to or withdrawal of that data, or from a recipient having moved, died, opted out or not being the owner.',
      'Without limiting the above, we are not liable for any failure, delay, error or loss by a Supplier, including in printing, mailing, delivery, payment processing, hosting or email, or for loss or damage to a postcard in the post, except that we will do what is set out in clauses 5.4 and 6.4.',
      'Except as set out in these terms, all conditions, warranties and terms that the law would otherwise imply into this agreement are excluded as far as the law allows.',
      'You agree that these limits are fair and reasonable given the price of the Service, and that you can insure against losses that we exclude.',
    ],
  },
  {
    title: 'Indemnity',
    clauses: [
      'You will pay us, and keep us protected against, any losses, claims, fines, costs and expenses (including reasonable legal fees) that we or our Suppliers suffer because of a claim by a third party, or action by a regulator, that comes from your postcards or their content, your marketing, your breach of these terms or the law, or your misuse of lead data.',
    ],
  },
  {
    title: 'Events outside our control',
    clauses: [
      'We are not liable for any delay or failure to perform caused by something outside our reasonable control. That includes strikes or industrial action (including at Royal Mail or another carrier), postal disruption, failures of the internet, power, hosting or a Supplier, government action or changes to public data, fire, flood, severe weather, epidemic, war, terrorism and cyber attack. If it goes on for a long time either of us can end the agreement by written notice.',
    ],
  },
  {
    title: 'Complaints',
    clauses: [
      'If you have a complaint, please email info@housepost.co.uk with the details. We will reply as soon as we reasonably can and try to put things right.',
    ],
  },
  {
    title: 'General',
    clauses: [
      'These terms and our privacy notice are the whole agreement between us about the Service and replace anything said or written before. You confirm that you have not relied on any statement that is not in them, though this does not exclude liability for fraud.',
      'We may update these terms. For a change that matters we will email you at least 30 days before it applies. If you keep using the Service after that date you accept the new terms. If you do not, you can cancel before it applies.',
      'You may not transfer your rights or duties under these terms to anyone else without our written consent. We may transfer ours to a company that takes over the Service and will tell you if we do.',
      'If a part of these terms is found to be invalid or unenforceable, the rest stays in force. If we do not enforce a right straight away, we have not given it up.',
      'Notices to you will be sent to the email address on your account. Notices to us should be sent to info@housepost.co.uk.',
      'Nobody other than you and us has any right to enforce these terms under the Contracts (Rights of Third Parties) Act 1999.',
    ],
  },
  {
    title: 'Governing law',
    clauses: [
      'These terms, and any dispute or claim arising out of or in connection with them (including non-contractual disputes), are governed by the law of England and Wales. The courts of England and Wales have exclusive jurisdiction.',
    ],
  },
]

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
            solicitor before go-live. The company details in section 1 still need
            to be filled in.
          </div>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
            {SECTIONS.map((section, si) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold text-slate-900">
                  {si + 1}. {section.title}
                </h2>
                <div className="mt-2 space-y-3">
                  {section.clauses.map((clause, ci) => (
                    <p key={ci} className="flex gap-3">
                      <span className="w-9 shrink-0 text-slate-400 tabular-nums">
                        {si + 1}.{ci + 1}
                      </span>
                      <span>{clause}</span>
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
