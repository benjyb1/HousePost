'use client'

import { useState } from 'react'
import chrome from '@/components/portal/page-chrome.module.css'
import s from './account.module.css'
import { readError } from './types'

/**
 * The email_notifications switch (PATCH /api/settings). A switch acts at once,
 * so it saves on change and flips back if the save fails.
 */
export function EmailsPanel({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function toggle(next: boolean) {
    setOn(next)
    setSaving(true)
    setError('')
    setDone('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_notifications: next }),
      })
      if (!res.ok) {
        setOn(!next)
        setError(await readError(res, 'That didn’t save. Try again.'))
      } else {
        setDone(next ? 'Emails are on.' : 'Emails are off.')
      }
    } catch {
      setOn(!next)
      setError('That didn’t save. Check your connection and try again.')
    }
    setSaving(false)
  }

  return (
    <section className={chrome.panel} aria-labelledby="acc-emails">
      <h2 id="acc-emails" className={s.heading}>Emails</h2>
      <label className={s.sw} htmlFor="acc-email-notifications">
        <span className={s.swText}>
          <span>Email me about account activity</span>
          <small id="acc-email-notifications-desc">
            For example when new homes arrive or you send cards. Receipts and other essential emails still come.
          </small>
        </span>
        <input
          id="acc-email-notifications"
          type="checkbox"
          role="switch"
          checked={on}
          disabled={saving}
          aria-describedby="acc-email-notifications-desc"
          onChange={(e) => toggle(e.target.checked)}
        />
      </label>
      <p className={s.ok} role="status">{done}</p>
      <p className={s.error} role="alert">{error}</p>
    </section>
  )
}
