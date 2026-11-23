'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import chrome from '@/components/portal/page-chrome.module.css'
import s from './account.module.css'
import { readError } from './types'

/**
 * Permanent account deletion (POST /api/account/delete), behind a typed
 * DELETE confirmation exactly as before. On success: sign out locally and go
 * to the login page.
 */
export function DeleteAccountPanel() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const field = useRef<HTMLInputElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) field.current?.focus()
    else if (wasOpen.current) openButton.current?.focus()
    wasOpen.current = open
  }, [open])

  function close() {
    setTyped('')
    setError('')
    setOpen(false)
  }

  async function remove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (typed !== 'DELETE') return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        setError(await readError(res, 'We couldn’t delete your account. Try again.'))
        setDeleting(false)
        return
      }
      // Account and login are gone. Sign out locally and send them to login.
      await createClient().auth.signOut()
      toast.success('Your account has been deleted')
      router.push('/login')
      router.refresh()
    } catch {
      setError('We couldn’t delete your account. Try again.')
      setDeleting(false)
    }
  }

  return (
    <section className={chrome.panel} aria-labelledby="acc-delete">
      <h2 id="acc-delete" className={s.heading}>Delete account</h2>
      <p className={s.lead}>
        This removes your account and login for good and cancels any subscription. We keep a record of the
        postcards you have sent.
      </p>
      {open ? (
        <form className={s.form} onSubmit={remove} noValidate>
          <div className={s.field}>
            <label htmlFor="acc-delete-confirm">Type DELETE to confirm</label>
            <input
              ref={field}
              id="acc-delete-confirm"
              className={s.input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          <div className={s.formActs}>
            <button
              type="submit"
              className={`${chrome.btn} ${s.btnDanger}`}
              disabled={typed !== 'DELETE' || deleting}
              aria-busy={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
            <button type="button" className={chrome.textbtn} onClick={close} disabled={deleting}>
              Keep my account
            </button>
          </div>
          <p className={s.error} role="alert">{error}</p>
        </form>
      ) : (
        <div className={s.acts}>
          <button ref={openButton} type="button" className={`${chrome.textbtn} ${s.danger}`} onClick={() => setOpen(true)}>
            Delete account
          </button>
        </div>
      )}
    </section>
  )
}
