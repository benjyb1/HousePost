import Link from 'next/link'

interface SubscriptionBannerProps {
  status: string
}

export function SubscriptionBanner({ status }: SubscriptionBannerProps) {
  if (status === 'active' || status === 'trialing') return null

  const messages: Record<string, string> = {
    past_due: 'Your payment is overdue, so new homes and sending are paused. Update your card to carry on.',
    canceled: 'Your subscription is cancelled. Subscribe again to get new homes and send postcards.',
    unpaid: 'You have unpaid invoices, so new homes and sending are paused. Update your billing details to carry on.',
    paused: 'Your subscription is paused.',
    incomplete: 'You’re not subscribed yet. Subscribe to get new homes and send postcards.',
    incomplete_expired: 'You’re not subscribed yet. Subscribe to get new homes and send postcards.',
  }

  const message = messages[status] ?? 'There’s a problem with your subscription.'

  return (
    <div role="status" className="border-b border-line bg-navy-tint text-navy-ink">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-3 text-[14.5px] leading-normal min-[980px]:px-8">
        <span className="min-w-0">{message}</span>
        <Link
          href="/account"
          className="shrink-0 font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-navy"
        >
          Manage billing
        </Link>
      </div>
    </div>
  )
}
