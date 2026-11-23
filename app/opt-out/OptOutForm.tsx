'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import styles from '@/components/layout/public.module.css'
import type { OptOutResult } from '@/app/api/opt-out/route'

// Interactive form — posts to /api/opt-out and shows a confirmation without a
// full page reload. This is a public page: no authentication required.
export function OptOutForm() {
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [town, setTown] = useState('')
  const [postcode, setPostcode] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressLine1, addressLine2, town, postcode }),
      })
      const data = (await res.json()) as OptOutResult

      if (data.ok) {
        setStatus('done')
      } else {
        setStatus('error')
        setErrorMessage(data.error)
      }
    } catch {
      setStatus('error')
      setErrorMessage(
        'Something went wrong sending your request. Please try again, or email info@housepost.co.uk.'
      )
    }
  }

  if (status === 'done') {
    return (
      <div className={`${styles.panel} ${styles.done}`} role="status">
        <h2>
          <CheckCircle aria-hidden="true" />
          You&rsquo;re opted out
        </h2>
        <p>
          Thank you. We&rsquo;ve added your address to our do-not-contact
          list and won&rsquo;t include it in future postal marketing. If a
          postcard was already in the post before you opted out, please
          accept our apologies. It should be the last one.
        </p>
        <p>
          If you have any questions, email us at{' '}
          <a className={styles.link} href="mailto:info@housepost.co.uk">
            info@housepost.co.uk
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className={styles.panel}>
        <p className={styles.formNote}>
          To make sure we suppress the right property, please enter the
          address <strong>exactly as it appears on the postcard</strong> you
          received, including the town.
        </p>

        <div className={styles.form}>
          <div>
            <label htmlFor="addressLine1" className={styles.label}>
              Address line 1
            </label>
            <Input
              id="addressLine1"
              name="addressLine1"
              type="text"
              autoComplete="address-line1"
              required
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g. 1 Tolpuddle Street"
              className="h-12 rounded-[3px] text-base md:text-base"
            />
          </div>

          <div>
            <label htmlFor="addressLine2" className={styles.label}>
              Address line 2 <span className={styles.optional}>(optional)</span>
            </label>
            <Input
              id="addressLine2"
              name="addressLine2"
              type="text"
              autoComplete="address-line2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="e.g. Islington"
              className="h-12 rounded-[3px] text-base md:text-base"
            />
          </div>

          <div className={styles.row}>
            <div className={styles.grow}>
              <label htmlFor="town" className={styles.label}>
                Town / city
              </label>
              <Input
                id="town"
                name="town"
                type="text"
                autoComplete="address-level2"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="e.g. London"
                className="h-12 rounded-[3px] text-base md:text-base"
              />
            </div>
            <div className="sm:w-44">
              <label htmlFor="postcode" className={styles.label}>
                Postcode
              </label>
              <Input
                id="postcode"
                name="postcode"
                type="text"
                autoComplete="postal-code"
                required
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="e.g. N1 1AB"
                className="h-12 rounded-[3px] text-base uppercase placeholder:normal-case md:text-base"
              />
            </div>
          </div>

          {status === 'error' && (
            <p className={styles.err} role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{errorMessage}</span>
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={status === 'submitting'}
            className="h-auto min-h-12 w-full py-3 text-[15px] leading-snug whitespace-normal sm:w-auto sm:justify-self-start"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Sending&hellip;
              </>
            ) : (
              'Add my address to the do-not-contact list'
            )}
          </Button>
        </div>
      </form>

      <p className={styles.small}>
        Prefer to read how we use your data first? See our{' '}
        <Link href="/privacy" className={styles.link}>
          privacy notice
        </Link>
        . You can also object by emailing{' '}
        <a className={styles.link} href="mailto:info@housepost.co.uk">
          info@housepost.co.uk
        </a>
        .
      </p>
    </>
  )
}
