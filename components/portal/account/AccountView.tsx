import Link from 'next/link'
import chrome from '@/components/portal/page-chrome.module.css'
import s from './account.module.css'
import type { AccountData } from './types'
import { PlanPanel } from './PlanPanel'
import { BusinessPanel } from './BusinessPanel'
import { EmailsPanel } from './EmailsPanel'
import { PasswordPanel } from './PasswordPanel'
import { DeleteAccountPanel } from './DeleteAccountPanel'
import { SignOutButton } from './SignOutButton'

const SUPPORT_EMAIL = 'info@housepost.co.uk'

/**
 * The Account page body: plan, business details, emails, password, help,
 * account deletion and sign out. Lead preferences (distance, price, property
 * types) live in the Home filter bar, not here.
 *
 * Must render inside a <LeaveGuardProvider> (Sign out uses it).
 */
export function AccountView({ data, note }: { data: AccountData; note?: string }) {
  return (
    <div className={chrome.page}>
      <div className={s.wrap}>
        <div className={chrome.title}>
          <h1>Account</h1>
          {note && <span className={s.sample}>{note}</span>}
        </div>

        <div className={s.acc}>
          <PlanPanel status={data.subscriptionStatus} periodEnd={data.subscriptionPeriodEnd} />

          <BusinessPanel
            email={data.email}
            initial={{
              fullName: data.fullName,
              companyName: data.companyName,
              officePostcode: data.officePostcode,
            }}
          />

          <EmailsPanel initial={data.emailNotifications} />

          <PasswordPanel />

          <section className={chrome.panel} aria-labelledby="acc-help">
            <h2 id="acc-help" className={s.heading}>Help</h2>
            <p className={s.lead}>How Housepost works, what each card status means and what to do if a card is late.</p>
            <div className={s.acts}>
              <Link href="/help" className={chrome.textbtn}>
                Read the help page
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={chrome.textbtn}>
                Email {SUPPORT_EMAIL}
              </a>
            </div>
          </section>

          <DeleteAccountPanel />

          <div className={s.foot}>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  )
}
