'use client'

import { useEffect, useState } from 'react'
import { INCLUDED_POSTCARDS_PER_MONTH, POSTCARD_OVERAGE_PENCE } from '@/types/profile'
import chrome from '@/components/portal/page-chrome.module.css'
import s from './account.module.css'
import { readError } from './types'

// Plain words for each Stripe status. Shown as ordinary text, never a badge.
const STATUS_TEXT: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Payment overdue',
  unpaid: 'Unpaid',
  paused: 'Paused',
  canceled: 'Cancelled',
  incomplete: 'Not subscribed',
  incomplete_expired: 'Not subscribed',
}

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  })
}

/**
 * Plan and billing. Anyone with a Stripe subscription, including one that is
 * overdue, unpaid or paused, goes to the Stripe billing portal
 * (POST /api/billing/portal) to change their card, pay, see invoices or
 * cancel. Only people with no subscription get a Subscribe button
 * (POST /api/billing/create-checkout), which also refuses a second one.
 */
export function PlanPanel({ status, periodEnd, hasSubscription }: { status: string; periodEnd: string | null; hasSubscription: boolean }) {
  const [busy, setBusy] = useState<'portal' | 'checkout' | null>(null)
  const [error, setError] = useState('')

  // Coming back from Stripe with the Back button restores this page from the
  // browser's cache, buttons still saying "Opening Stripe…". Reset them.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(null)
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const isActive = status === 'active' || status === 'trialing'
  const needsAttention = !isActive && hasSubscription
  const extra = `£${(POSTCARD_OVERAGE_PENCE / 100).toFixed(2)}`

  async function go(kind: 'portal' | 'checkout') {
    setBusy(kind)
    setError('')
    const fallback = kind === 'portal' ? 'We couldn’t open billing. Try again in a minute.' : 'We couldn’t start checkout. Try again in a minute.'
    try {
      const res = await fetch(kind === 'portal' ? '/api/billing/portal' : '/api/billing/create-checkout', { method: 'POST' })
      if (kind === 'checkout' && res.status === 409) {
        // Already subscribed (perhaps from another tab): open billing instead.
        return go('portal')
      }
      if (!res.ok) {
        setError(await readError(res, fallback))
      } else {
        const data = (await res.json().catch(() => ({}))) as { url?: string }
        if (data.url) {
          window.location.assign(data.url)
          return
        }
        setError(fallback)
      }
    } catch {
      setError(fallback)
    }
    setBusy(null)
  }

  return (
    <section className={chrome.panel} aria-labelledby="acc-plan">
      <h2 id="acc-plan" className={s.heading}>Plan</h2>
      <dl className={s.kv}>
        <dt>Status</dt>
        <dd>{STATUS_TEXT[status] ?? 'Not subscribed'}</dd>
        <dt>Subscription</dt>
        <dd>£15 a month, {INCLUDED_POSTCARDS_PER_MONTH} cards included</dd>
        <dt>Extra cards</dt>
        <dd>{extra} each</dd>
        {isActive && periodEnd && (
          <>
            <dt>Next payment</dt>
            <dd>{formatLongDate(periodEnd)}</dd>
          </>
        )}
      </dl>

      {isActive ? (
        <>
          <div className={s.acts}>
            <button type="button" className={chrome.textbtn} onClick={() => go('portal')} disabled={busy !== null} aria-busy={busy === 'portal'}>
              {busy === 'portal' ? 'Opening Stripe…' : 'Manage billing'}
            </button>
            <button type="button" className={chrome.textbtn} onClick={() => go('portal')} disabled={busy !== null}>
              Cancel subscription
            </button>
          </div>
          <p className={s.note}>Both open Stripe, where you can change your card, download invoices or cancel.</p>
        </>
      ) : needsAttention ? (
        <>
          <div className={s.acts}>
            <button type="button" className={chrome.btn} onClick={() => go('portal')} disabled={busy !== null} aria-busy={busy === 'portal'}>
              {busy === 'portal' ? 'Opening Stripe…' : status === 'paused' ? 'Manage billing' : 'Update your card'}
            </button>
          </div>
          <p className={s.note}>
            {status === 'paused'
              ? 'Your subscription is paused. You can restart or cancel it in Stripe.'
              : 'Stripe couldn’t take your last payment. Update your card or pay the invoice there, and sending starts again. You can also cancel there.'}
          </p>
        </>
      ) : (
        <>
          <div className={s.acts}>
            <button type="button" className={chrome.btn} onClick={() => go('checkout')} disabled={busy !== null} aria-busy={busy === 'checkout'}>
              {busy === 'checkout' ? 'Opening Stripe…' : 'Subscribe for £15 a month'}
            </button>
          </div>
          <p className={s.note}>You pay by card through Stripe and can cancel any time.</p>
        </>
      )}

      <p className={s.error} role="alert">{error}</p>
    </section>
  )
}
