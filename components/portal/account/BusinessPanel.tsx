'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import chrome from '@/components/portal/page-chrome.module.css'
import s from './account.module.css'
import { readError } from './types'

interface Details {
  fullName: string
  companyName: string | null
  officePostcode: string
}

const normalisePostcode = (pc: string) => pc.toUpperCase().replace(/\s+/g, ' ').trim()

/**
 * Name, business name and office postcode (PATCH /api/settings). The postcode
 * is only sent when it changed, because the API re-geocodes it and answers 400
 * when it can't find it; that message is shown under the field.
 */
export function BusinessPanel({ email, initial }: { email: string | null; initial: Details }) {
  const router = useRouter()
  const [saved, setSaved] = useState<Details>(initial)
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(initial.fullName)
  const [companyName, setCompanyName] = useState(initial.companyName ?? '')
  const [postcode, setPostcode] = useState(initial.officePostcode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [done, setDone] = useState('')

  const firstField = useRef<HTMLInputElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  // Move focus into the form when it opens, and back to "Edit details" when it closes.
  useEffect(() => {
    if (editing) firstField.current?.focus()
    else if (wasEditing.current) editButton.current?.focus()
    wasEditing.current = editing
  }, [editing])

  function startEdit() {
    setFullName(saved.fullName)
    setCompanyName(saved.companyName ?? '')
    setPostcode(saved.officePostcode)
    setError('')
    setPostcodeError('')
    setDone('')
    setEditing(true)
  }

  function cancel() {
    setError('')
    setPostcodeError('')
    setEditing(false)
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setPostcodeError('')

    const pc = normalisePostcode(postcode)
    if (!pc) {
      setPostcodeError('Enter your office postcode.')
      return
    }

    const next: Details = {
      fullName: fullName.trim(),
      companyName: companyName.trim() || null,
      officePostcode: pc,
    }
    const body: Record<string, unknown> = {
      full_name: next.fullName,
      company_name: next.companyName,
    }
    if (pc !== normalisePostcode(saved.officePostcode)) body.office_postcode = pc

    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const message = await readError(res, 'We couldn’t save your details. Try again.')
        // 400 only ever means the postcode lookup failed.
        if (res.status === 400) setPostcodeError(message)
        else setError(message)
        setSaving(false)
        return
      }
      setSaved(next)
      setSaving(false)
      setEditing(false)
      setDone('Details saved.')
      // The top bar's initials are drawn from these names on the server.
      router.refresh()
    } catch {
      setError('We couldn’t save your details. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <section className={chrome.panel} aria-labelledby="acc-biz">
      <h2 id="acc-biz" className={s.heading}>Business</h2>

      {editing ? (
        <form className={s.form} onSubmit={save} noValidate>
          <div className={s.field}>
            <label htmlFor="acc-name">Your name</label>
            <input
              ref={firstField}
              id="acc-name"
              className={s.input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className={s.field}>
            <label htmlFor="acc-company">Business name</label>
            <input
              id="acc-company"
              className={s.input}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
              placeholder="Optional"
            />
          </div>
          <div className={s.field}>
            <label htmlFor="acc-postcode">Office postcode</label>
            <input
              id="acc-postcode"
              className={s.input}
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              autoComplete="postal-code"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={postcodeError ? true : undefined}
              aria-describedby={postcodeError ? 'acc-postcode-hint acc-postcode-error' : 'acc-postcode-hint'}
            />
            <span id="acc-postcode-hint" className={s.hint}>We look for sold homes around this postcode.</span>
            {postcodeError && (
              <span id="acc-postcode-error" className={s.fieldError} role="alert">
                {postcodeError}
              </span>
            )}
          </div>
          <div className={s.formActs}>
            <button type="submit" className={chrome.btn} disabled={saving} aria-busy={saving}>
              {saving ? 'Saving…' : 'Save details'}
            </button>
            <button type="button" className={chrome.textbtn} onClick={cancel} disabled={saving}>
              Cancel
            </button>
          </div>
          <p className={s.error} role="alert">{error}</p>
        </form>
      ) : (
        <>
          <dl className={s.kv}>
            <dt>Your name</dt>
            <dd>{saved.fullName || <span className={s.unset}>Not set</span>}</dd>
            <dt>Business name</dt>
            <dd>{saved.companyName || <span className={s.unset}>Not set</span>}</dd>
            <dt>Office postcode</dt>
            <dd>{saved.officePostcode || <span className={s.unset}>Not set</span>}</dd>
            <dt>Email</dt>
            <dd>{email ?? <span className={s.unset}>Not available</span>}</dd>
          </dl>
          <div className={s.acts}>
            <button ref={editButton} type="button" className={chrome.textbtn} onClick={startEdit}>
              Edit details
            </button>
          </div>
        </>
      )}

      <p className={s.ok} role="status">{done}</p>
    </section>
  )
}
