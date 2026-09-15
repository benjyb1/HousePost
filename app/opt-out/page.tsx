'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { SiteFooter } from '@/components/layout/SiteFooter'
import type { OptOutResult } from '@/app/api/opt-out/route'

// Interactive form — posts to /api/opt-out and shows a confirmation without a
// full page reload. This is a public page: no authentication required.
export default function OptOutPage() {
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
        <section className="bg-brand">
          <div className="mx-auto max-w-3xl px-5 pt-14 pb-16 sm:px-6 sm:pt-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white">
              <ShieldCheck className="h-3.5 w-3.5" />
              Opt out of postal marketing
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Rather not receive our postcards? No problem.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              Your address came from HM Land Registry&rsquo;s public record of property
              sales. If you&rsquo;d prefer we didn&rsquo;t post marketing to your home,
              just tell us the address below and we&rsquo;ll add it to our
              do-not-contact list. It only takes a moment.
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-3xl px-5 sm:px-6">
            {status === 'done' ? (
              <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
                <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
                <div>
                  <h2 className="text-lg font-semibold">You&rsquo;re opted out</h2>
                  <p className="mt-2 text-sm leading-relaxed text-green-800">
                    Thank you. We&rsquo;ve added your address to our do-not-contact
                    list and won&rsquo;t include it in future postal marketing. If a
                    postcard was already in the post before you opted out, please
                    accept our apologies &mdash; it should be the last one.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-green-800">
                    If you have any questions, email us at{' '}
                    <a
                      className="font-medium underline"
                      href="mailto:info@housepost.co.uk"
                    >
                      info@housepost.co.uk
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                  To make sure we suppress the right property, please enter the
                  address <strong>exactly as it appears on the postcard</strong> you
                  received, including the town.
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <label
                        htmlFor="addressLine1"
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Address line 1
                      </label>
                      <input
                        id="addressLine1"
                        name="addressLine1"
                        type="text"
                        autoComplete="address-line1"
                        required
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        placeholder="e.g. 1 Tolpuddle Street"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="addressLine2"
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Address line 2 <span className="font-normal normal-case text-slate-400">(optional)</span>
                      </label>
                      <input
                        id="addressLine2"
                        name="addressLine2"
                        type="text"
                        autoComplete="address-line2"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        placeholder="e.g. Islington"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="flex-1">
                        <label
                          htmlFor="town"
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Town / city
                        </label>
                        <input
                          id="town"
                          name="town"
                          type="text"
                          autoComplete="address-level2"
                          value={town}
                          onChange={(e) => setTown(e.target.value)}
                          placeholder="e.g. London"
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                      <div className="sm:w-44">
                        <label
                          htmlFor="postcode"
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Postcode
                        </label>
                        <input
                          id="postcode"
                          name="postcode"
                          type="text"
                          autoComplete="postal-code"
                          required
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          placeholder="e.g. N1 1AB"
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                    </div>

                    {status === 'error' && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {status === 'submitting' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending&hellip;
                        </>
                      ) : (
                        'Add my address to the do-not-contact list'
                      )}
                    </button>
                  </div>
                </form>

                <p className="mt-5 text-sm leading-relaxed text-slate-500">
                  Prefer to read how we use your data first? See our{' '}
                  <Link href="/privacy" className="font-medium text-brand underline">
                    privacy notice
                  </Link>
                  . You can also object by emailing{' '}
                  <a
                    className="font-medium text-brand underline"
                    href="mailto:info@housepost.co.uk"
                  >
                    info@housepost.co.uk
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
