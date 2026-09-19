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

type Clause = {
  lead: React.ReactNode
  list?: string[]
  listStyle?: 'alpha' | 'bullet'
  tail?: React.ReactNode
}
type Section = { title: string; clauses: Clause[] }

const SECTIONS: Section[] = [
  {
    title: 'About us and these terms',
    clauses: [
      {
        lead: (
          <>
            Housepost is a trading name of [OWNER’S FULL NAME] (“we”, “us”), whose
            address for service is [ADDRESS FOR SERVICE]. You can contact us at{' '}
            <a className={link} href="mailto:info@housepost.co.uk">
              info@housepost.co.uk
            </a>
            .
          </>
        ),
      },
      {
        lead: (
          <>
            These terms form the contract between you and us for the Housepost
            website and service (the “Service”). You accept them when you create
            your account. They are available in English only, and you can download
            or print them at any time from{' '}
            <Link className={link} href="/terms">
              www.housepost.co.uk/terms
            </Link>
            .
          </>
        ),
      },
      {
        lead: 'The Service is for businesses only. By accepting these terms, you confirm that you are 18 or over and are acting for the purposes of your trade, business or profession. If you accept for a company or other organisation, you confirm that you have authority to bind it, and “you” includes it.',
      },
    ],
  },
  {
    title: 'The Service',
    clauses: [
      {
        lead: 'Each month, after HM Land Registry publishes its Price Paid Data update, we show you recorded sales of properties in England and Wales that match your settings, such as your business postcode, radius, price range and property types (“Leads”). For each Lead we show its address and sale details (“Lead Data”). You choose which Leads to send your postcard to, and we arrange for it to be printed and posted.',
      },
      {
        lead: 'We aim to show you at least 15 new Leads each month. If fewer match your settings, we may widen your radius in 5-mile steps to find more. We do not guarantee any number of Leads. Leads are not exclusive: other customers, including your competitors, may receive the same ones.',
      },
      { lead: 'We will provide the Service with reasonable care and skill.' },
      {
        lead: 'We may change the Service. If a change would materially reduce what you pay for, we will give you at least 30 days’ notice and you may cancel before it takes effect. If the change is needed sooner for legal, security or data-supply reasons, we will give as much notice as we reasonably can.',
      },
      {
        lead: 'We do not guarantee that the Service will be uninterrupted or error-free. We may suspend it for maintenance or security reasons, and will try to keep any interruption short.',
      },
      {
        lead: 'We do not promise any result from using the Service, including any number of enquiries, jobs or sales. Response to direct mail varies and is outside our control.',
      },
    ],
  },
  {
    title: 'Lead Data',
    clauses: [
      {
        lead: 'Leads are derived from HM Land Registry Price Paid Data. Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.',
      },
      {
        lead: 'We do not create or verify this data, and we do not warrant that it or any Lead is accurate, complete or up to date. It is published in arrears, not every sale appears, and addresses may be incomplete or wrong. A Lead does not mean that the buyer lives at the address, still owns it or wants to hear from you.',
      },
      {
        lead: 'We may remove, withhold or correct any Lead at any time, for example where someone has opted out or we think the data is wrong.',
      },
      {
        lead: 'Delays in, changes to or withdrawal of that data do not entitle you to a refund or compensation, except under clause 15.3.',
      },
      {
        lead: 'You must not say or imply that HM Land Registry or any other public body endorses you, us or your business.',
      },
    ],
  },
  {
    title: 'Your account',
    clauses: [
      { lead: 'You must give us accurate information and keep it up to date.' },
      {
        lead: 'You must keep your login details secure and not share them outside your business. You are responsible for all activity on your account. If you think someone else has access to it, tell us promptly.',
      },
    ],
  },
  {
    title: 'Price and payment',
    clauses: [
      {
        lead: 'The subscription costs £15 per monthly billing period (“Billing Period”) and includes 5 postcards per Billing Period (your “Allowance”). Each further postcard costs £1.50. You may order up to 50 postcards per Billing Period unless we agree otherwise. Unused Allowance does not carry over.',
      },
      {
        lead: 'We are not currently registered for VAT, so we do not charge it. If we register, we will give you at least 30 days’ notice by email before adding VAT at the applicable rate, and you may cancel before then.',
      },
      {
        lead: 'Your subscription renews automatically each Billing Period until you cancel. We charge the subscription fee in advance. We charge for postcards beyond your Allowance when you confirm the Order. We take payment by card through our payment provider, Stripe, and do not see or store your full card details. You authorise us to charge your card for these amounts.',
      },
      {
        lead: 'If a payment fails, we may retry it and suspend your account until it is paid. You must keep your card details up to date.',
      },
      {
        lead: 'We may change our prices by giving you at least 30 days’ notice by email. New prices apply from your first renewal after the notice period ends. If you do not agree, you may cancel before then.',
      },
      { lead: 'Except as set out in these terms, fees are non-refundable.' },
    ],
  },
  {
    title: 'Designs and orders',
    clauses: [
      {
        lead: (
          <>
            You provide your postcard artwork and text (your “Design”). Your Design
            must meet our{' '}
            <Link className={link} href="/print-specs">
              print specifications
            </Link>{' '}
            and include your business name and contact details. Each postcard may
            also carry:
          </>
        ),
        list: [
          'the recipient’s address;',
          'a statement that it was sent via Housepost; and',
          'our privacy and opt-out wording.',
        ],
        listStyle: 'bullet',
        tail: 'You must leave clear the space our print specifications reserve for these, and must not remove, obscure or alter them.',
      },
      {
        lead: 'When you confirm an order (an “Order”), it is held for 15 minutes before it goes to print. You can cancel it during that time from the Postcards page. If you do, you will not be charged for it and any Allowance used will be restored. After that, the Order cannot be cancelled or changed.',
      },
      {
        lead: 'You must check the preview before confirming an Order, including where the address will be printed and the margins that will be trimmed. We print what you approve. Small differences in colour, cropping and alignment between screen and print are normal and are not a defect.',
      },
      {
        lead: 'This clause applies if a postcard in your Order:',
        list: [
          'is not printed or handed to a carrier because of a fault in our systems or those of a Supplier (see clause 7.1); or',
          'is printed materially differently from the preview you approved, for a reason other than your Design.',
        ],
        listStyle: 'alpha',
        tail: 'We will, at our option, either reprint and resend it, or not charge you for it and return the Lead to your list. If we do not charge you, we will refund any charge already made and restore any Allowance used. This is your only remedy for those failures.',
      },
      {
        lead: 'We may refuse, hold or cancel any Design or Order that we reasonably believe breaches these terms or the law. If we cancel an Order, you will not be charged for the cancelled postcards and any Allowance used will be restored.',
      },
    ],
  },
  {
    title: 'Printing, delivery and Suppliers',
    clauses: [
      {
        lead: 'We use other companies to provide parts of the Service (“Suppliers”). These include print and mailing providers, Royal Mail and other carriers, Stripe, and hosting, database and email providers.',
      },
      {
        lead: 'Our responsibility is to arrange, within a reasonable time, for each postcard in an Order to be printed and handed to a carrier. We do not control delivery. We do not guarantee that a postcard will be delivered, delivered by a particular date or received by a particular person. Post can be delayed, lost or damaged.',
      },
      {
        lead: 'If we recover compensation from a Supplier for a lost or damaged postcard in your Order, we will pass on the part that relates to it. We do not have to bring legal proceedings against a Supplier.',
      },
    ],
  },
  {
    title: 'Your postcards and marketing',
    clauses: [
      {
        lead: 'You are solely responsible for your Designs and for how you market your business.',
      },
      {
        lead: 'You promise that your Designs will be accurate, honest and lawful. They will comply with the UK Code of Non-broadcast Advertising and Direct & Promotional Marketing (the CAP Code), consumer protection law, any rules on advertising finance or credit, and any rules that apply to your trade. They must not:',
        list: [
          'be misleading, offensive, defamatory, discriminatory or threatening, or infringe anyone’s rights;',
          'look as if they come from HM Land Registry, any other public body, or anyone involved in the recipient’s purchase;',
          'mention the price paid, the date of sale or any other Lead Data, beyond a general reference to a recent move or purchase; or',
          'link to anything unlawful or harmful.',
        ],
        listStyle: 'alpha',
      },
      {
        lead: 'You must be able to prove any claim in your Designs, for example about qualifications, accreditations, insurance, prices or guarantees.',
      },
      { lead: 'You may use the Service only to market your own genuine business.' },
      {
        lead: 'We do not check or approve Designs and are not responsible for them, but we may reject or remove any Design at any time.',
      },
      {
        lead: 'When a recipient opts out, we will stop sending Housepost postcards to that address. If a recipient tells you they do not want to hear from you, you must respect that.',
      },
    ],
  },
  {
    title: 'Use of the Service and Lead Data',
    clauses: [
      {
        lead: 'You may use Lead Data only to choose recipients and send postcards through the Service for your own business. You must not:',
        list: [
          'copy, export, scrape, store outside the Service, sell, share or publish Lead Data;',
          'use it to build any list or database; or',
          'use it to contact anyone in any other way, including by phone, email or in person.',
        ],
        listStyle: 'alpha',
      },
      {
        lead: 'You must not:',
        list: [
          'copy, modify or reverse engineer the Service, except as the law allows;',
          'access it using bots, scrapers or other automated tools;',
          'try to get round its limits or security, or gain unauthorised access to it or our systems;',
          'introduce viruses or other harmful code, or otherwise interfere with how it works;',
          'use it to build a competing product or service; or',
          'use it to harass anyone.',
        ],
        listStyle: 'alpha',
      },
    ],
  },
  {
    title: 'Data protection',
    clauses: [
      {
        lead: (
          <>
            Each of us will comply with UK data protection law, including the UK
            GDPR and the Data Protection Act 2018, in connection with the Service.
            Our{' '}
            <Link className={link} href="/privacy">
              privacy notice
            </Link>{' '}
            explains how we use personal data, including yours and recipients’.
          </>
        ),
      },
      {
        lead: 'We are a controller of the personal data in Lead Data. We are responsible for:',
        list: [
          'giving recipients privacy information, including on each postcard;',
          'handling their opt-outs, objections and other requests relating to the Service;',
          'keeping a suppression list; and',
          'keeping the Service secure.',
        ],
        listStyle: 'alpha',
      },
      {
        lead: 'You are a controller of any personal data you process for your own purposes, including when you choose recipients and when a recipient contacts you. When doing so you must comply with data protection law and use Lead Data only as these terms allow. You must pass to us, within 5 working days, any request or objection you receive about Housepost postcards.',
      },
      {
        lead: 'If we are joint controllers of any processing, this clause 10 is our arrangement under Article 26 of the UK GDPR, and we will be recipients’ point of contact.',
      },
    ],
  },
  {
    title: 'Intellectual property',
    clauses: [
      {
        lead: 'We and our licensors own all rights in the Service, our website and our presentation of Lead Data. We give you a non-exclusive, non-transferable right to use the Service for your business while your subscription is active.',
      },
      {
        lead: 'You keep all rights in your Designs. You give us and our Suppliers a non-exclusive, royalty-free licence to store, copy, adapt (for example, resize or reformat) and print them as needed to provide the Service.',
      },
      {
        lead: 'You promise that you own, or have permission to use, everything in your Designs, and that our use of them under these terms will not infringe anyone’s rights.',
      },
      {
        lead: 'We may use anonymised, aggregated information about use of the Service, and any feedback you give us, to operate and improve the Service.',
      },
    ],
  },
  {
    title: 'Confidentiality',
    clauses: [
      {
        lead: 'Each of us will keep confidential any non-public information about the other’s business received through the Service, and will use it only for the purposes of these terms. Either of us may disclose it where the law requires. Either of us may also disclose it to professional advisers, and we may disclose it to Suppliers, who need it and are bound by confidentiality.',
      },
    ],
  },
  {
    title: 'Our liability',
    clauses: [
      {
        lead: 'Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or any other liability that cannot lawfully be limited or excluded.',
      },
      {
        lead: 'Subject to clause 13.1, the rest of this clause 13 applies to all our liability arising under or in connection with these terms or the Service. This covers liability in contract, tort (including negligence), breach of statutory duty, misrepresentation or otherwise.',
      },
      {
        lead: 'We are not liable for:',
        list: [
          'any loss of profit, revenue or sales;',
          'any loss of business, contracts or opportunity;',
          'any loss of goodwill or reputation;',
          'any loss of anticipated savings;',
          'any loss or corruption of data (but see clause 13.6),',
        ],
        listStyle: 'alpha',
        tail: 'in each case whether direct or indirect; or (f) any indirect or consequential loss.',
      },
      {
        lead: 'Our total liability to you for all events occurring in a Contract Year is limited to the greater of:',
        list: [
          '£100; and',
          'the total fees you paid us in the 12 months before the first of those events.',
        ],
        listStyle: 'alpha',
        tail: 'A “Contract Year” is each 12-month period starting on the date you first subscribed or an anniversary of it.',
      },
      {
        lead: 'We are not liable for any loss arising from:',
        list: [
          'the content, accuracy, completeness, timeliness or availability of HM Land Registry or other third-party data;',
          'a recipient not living at the address, not being the buyer or having opted out;',
          'anything that happens to a postcard after it has been handed to a carrier; or',
          'failures or delays of the internet or other networks we do not control.',
        ],
        listStyle: 'alpha',
        tail: 'This does not affect clauses 6.4 and 7.3.',
      },
      {
        lead: 'If your Designs or account data are lost or damaged, we will use reasonable efforts to restore them from our latest back-up. That is your only remedy for such loss. Please keep your own copies of your Designs.',
      },
      {
        lead: 'Except as set out in these terms, all terms implied by law are excluded to the fullest extent the law allows.',
      },
      {
        lead: 'Our employees and contractors have no personal liability to you in connection with the Service, except liability that cannot lawfully be excluded. They may enforce this clause 13.8.',
      },
      {
        lead: 'Our prices reflect the allocation of risk in these terms. You may wish to insure against losses we exclude.',
      },
    ],
  },
  {
    title: 'Indemnity',
    clauses: [
      {
        lead: 'You will indemnify us against all losses, liabilities, costs and expenses arising from any claim by a third party, or action by a regulator, to the extent it results from:',
        list: [
          'your Designs or marketing;',
          'your breach of these terms or of the law; or',
          'your misuse of Lead Data.',
        ],
        listStyle: 'alpha',
        tail: 'This includes reasonable legal fees, sums we must pay a Supplier and, where the law allows, fines. It does not apply to the extent the loss is caused by our breach of these terms or our negligence.',
      },
    ],
  },
  {
    title: 'Cancellation, suspension and termination',
    clauses: [
      {
        lead: 'You can cancel your subscription at any time from the billing section of your account. It will end at the end of the current Billing Period. We do not refund part periods or unused Allowance. Orders that have already gone to print will still be sent and charged.',
      },
      {
        lead: 'We may suspend or close your account immediately by notice if:',
        list: [
          'you seriously or repeatedly breach these terms;',
          'we reasonably suspect fraud or misuse; or',
          'a payment remains unpaid after we have told you about it.',
        ],
        listStyle: 'alpha',
        tail: 'Where we reasonably can, we will tell you why.',
      },
      {
        lead: 'We may end your subscription, or the Service generally, for any other reason on at least 30 days’ notice. We may give shorter notice if we can no longer lawfully provide the Service or obtain Lead Data or a key Supplier’s services. We will refund any fees you have paid for the period after it ends.',
      },
      {
        lead: 'When your subscription ends, your access to the Service ends. We may delete your Designs and account data 30 days afterwards, except anything we must keep by law. Clauses 3, 5, 8 to 14, 19 and 20, and any other provision intended to continue, will continue to apply.',
      },
    ],
  },
  {
    title: 'Events outside our control',
    clauses: [
      {
        lead: 'We are not liable for any delay or failure to perform caused by events outside our reasonable control. These include:',
        list: [
          'strikes or other industrial action, including at Royal Mail or another carrier;',
          'postal disruption;',
          'failure of the internet, power, hosting or a Supplier;',
          'changes to or withdrawal of public data;',
          'government action; and',
          'fire, flood, severe weather, epidemic, war, terrorism or cyber-attack.',
        ],
        listStyle: 'bullet',
        tail: 'If such an event continues for more than 30 days, either of us may end the contract by notice.',
      },
    ],
  },
  {
    title: 'Changes to these terms',
    clauses: [
      {
        lead: 'We may update these terms. We will give you at least 30 days’ notice by email of any change that materially affects you. If a change is needed sooner for legal, regulatory or security reasons, we will give as much notice as we reasonably can. If you keep using the Service after a change takes effect, you accept it. If you do not agree, you may cancel before it takes effect.',
      },
    ],
  },
  {
    title: 'Complaints',
    clauses: [
      {
        lead: 'Please send any complaint to info@housepost.co.uk or to our address for service. We will respond as soon as we reasonably can and try to put things right.',
      },
    ],
  },
  {
    title: 'General',
    clauses: [
      {
        lead: 'These terms are the entire agreement between us about the Service and replace anything said or written before. You confirm that you have not relied on any statement or promise not set out in them. Nothing in this clause limits liability for fraud.',
      },
      {
        lead: 'You may not transfer your rights or obligations under these terms without our written consent. We may transfer ours to anyone who takes over all or part of the Service, including a company set up to run Housepost, and will tell you if we do.',
      },
      {
        lead: 'If any part of these terms is found invalid or unenforceable, the rest remains in force.',
      },
      {
        lead: 'If we delay or do not enforce a right, we have not waived it.',
      },
      {
        lead: 'Nothing in these terms creates a partnership or agency between us.',
      },
      {
        lead: 'Apart from our employees and contractors under clause 13.8, no one other than you and us may enforce these terms under the Contracts (Rights of Third Parties) Act 1999. We may vary or end these terms without anyone else’s consent.',
      },
      {
        lead: 'We will send notices to the email address on your account. You must send notices to info@housepost.co.uk.',
      },
      {
        lead: 'Regulations 9(1), 9(2) and 11(1) of the Electronic Commerce (EC Directive) Regulations 2002 do not apply to our contract.',
      },
    ],
  },
  {
    title: 'Governing law and jurisdiction',
    clauses: [
      {
        lead: 'These terms, and any dispute or claim arising out of or in connection with them or the Service, are governed by the law of England and Wales. This includes non-contractual disputes or claims. The courts of England and Wales have exclusive jurisdiction.',
      },
    ],
  },
]

const KEY_POINTS = [
  'Housepost is for businesses only. You accept these terms when you create your account.',
  'It costs £15 a month (we do not currently charge VAT), including 5 postcards. Extra postcards are £1.50 each. You can cancel at any time, and your plan runs to the end of the month you have paid for.',
  'Leads come from HM Land Registry data, which can be wrong or incomplete, and they are not exclusive to you. We do not guarantee results. Once a postcard is posted, delivery is in the carrier’s hands.',
  'You are responsible for your postcards, and you may use leads only to send postcards through Housepost.',
  'Our liability to you is limited (clause 13). You must cover our losses from claims caused by your postcards or your misuse of leads (clause 14).',
]

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'

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
            Housepost terms of service
          </h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: [DATE]</p>

          {/* Draft banner — remove once the placeholders are filled in and the terms are approved. */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            <strong>Draft &mdash; not final.</strong> The owner’s name, address for
            service and “last updated” date in square brackets still need to be
            filled in, and the terms need a final legal review before go-live.
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Key points{' '}
              <span className="font-normal text-slate-500">
                (a summary only; the terms below prevail)
              </span>
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700">
              {KEY_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
            {SECTIONS.map((section, si) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold text-slate-900">
                  {si + 1}. {section.title}
                </h2>
                <div className="mt-2 space-y-3">
                  {section.clauses.map((clause, ci) => (
                    <div key={ci} className="flex gap-3">
                      <span className="w-10 shrink-0 text-slate-400 tabular-nums">
                        {si + 1}.{ci + 1}
                      </span>
                      <div className="space-y-2">
                        <p>{clause.lead}</p>
                        {clause.list && (
                          <ul className="space-y-1">
                            {clause.list.map((item, li) => (
                              <li key={item} className="flex gap-2">
                                <span className="w-6 shrink-0 text-slate-400">
                                  {clause.listStyle === 'bullet' ? '•' : `(${ALPHA[li]})`}
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {clause.tail && <p>{clause.tail}</p>}
                      </div>
                    </div>
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
