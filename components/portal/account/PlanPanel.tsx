'use client'

import { useState } from 'react'
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
 * Plan and billing. Subscribed people go to the Stripe billing portal
 * (POST /api/billing/portal) to change their card, see invoices or cancel;
 * everyone else gets a Subscribe button (POST /api/billing/create-checkout).
 * Same calls and the same active/trialing rule as the old Account page.
 */
export function PlanPanel({ status, periodEnd }: { status: string; periodEnd: string | null }) {
  const [busy, setBusy] = useState<'portal' | 'checkout' | null>(null)
  const [error, setError] = useState('')

  const isActive = status === 'active' || status === 'trialing'
  const extra = `£${(POSTCARD_OVERAGE_PENCE / 100).toFixed(2)}`

  async function go(kind: 'portal' | 'checkout') {
    setBusy(kind)
    setError('')
    const fallback = kind === 'portal' ? 'We couldn’t open billing. Try again in a minute.' : 'We couldn’t start checkout. Try again in a minute.'
    try {
      const res = await fetch(kind === 'portal' ? '/api/billing/portal' : '/api/billing/create-checkout', { method: 'POST' })
      if (!res.ok) {
        setError(await readError(res, fallback))
      } else {
        const data = (await res.json().catch(() => ({}))) as { url?: string }
        if (data.url) {
          window.location.href = data.url
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
