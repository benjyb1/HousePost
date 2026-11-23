'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import chrome from '@/components/portal/page-chrome.module.css'
import s from './account.module.css'

/** Change password with supabase.auth.updateUser, same rules as before (8+ characters, typed twice). */
export function PasswordPanel() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const firstField = useRef<HTMLInputElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) firstField.current?.focus()
    else if (wasOpen.current) openButton.current?.focus()
    wasOpen.current = open
  }, [open])

  function close() {
    setPassword('')
    setConfirm('')
    setError('')
    setOpen(false)
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setSaving(true)
    try {
      const { error: authError } = await createClient().auth.updateUser({ password })
      if (authError) {
        setError(authError.message)
        setSaving(false)
        return
      }
      setSaving(false)
      close()
      setDone('Password changed.')
    } catch {
      setError('We couldn’t change your password. Try again.')
      setSaving(false)
    }
  }

  return (
    <section className={chrome.panel} aria-labelledby="acc-password">
      <h2 id="acc-password" className={s.heading}>Password</h2>
      {open ? (
        <form className={s.form} onSubmit={save} noValidate>
          <div className={s.field}>
            <label htmlFor="acc-new-password">New password</label>
            <input
              ref={firstField}
              id="acc-new-password"
              type="password"
              className={s.input}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="acc-new-password-hint"
              aria-invalid={error && password.length < 8 ? true : undefined}
            />
            <span id="acc-new-password-hint" className={s.hint}>At least 8 characters.</span>
          </div>
          <div className={s.field}>
            <label htmlFor="acc-confirm-password">Type it again</label>
            <input
              id="acc-confirm-password"
              type="password"
              className={s.input}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={error && password.length >= 8 && password !== confirm ? true : undefined}
            />
          </div>
          <div className={s.formActs}>
            <button type="submit" className={chrome.btn} disabled={saving} aria-busy={saving}>
              {saving ? 'Saving…' : 'Save password'}
            </button>
            <button type="button" className={chrome.textbtn} onClick={close} disabled={saving}>
              Cancel
            </button>
          </div>
          <p className={s.error} role="alert">{error}</p>
        </form>
      ) : (
        <>
          <p className={s.lead}>Change the password you sign in with.</p>
          <div className={s.acts}>
            <button
              ref={openButton}
              type="button"
              className={chrome.textbtn}
              onClick={() => {
                setDone('')
                setOpen(true)
              }}
            >
              Change password
            </button>
          </div>
        </>
      )}
      <p className={s.ok} role="status">{done}</p>
    </section>
  )
}
