'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    // Deliberately don't reveal whether the email is registered: Supabase
    // answers 200 for an unknown address, so any error here is OUR problem
    // (rate limit, or the mail relay refusing to send) and must not be dressed
    // up as "check your email" — that would strand the user waiting for a
    // message that never left.
    if (error && error.status === 429) {
      setError('Too many attempts. Please wait a moment and try again.')
      setLoading(false)
      return
    }
    if (error) {
      setError(
        'We could not send the reset email just now. Please try again in a few minutes, or contact info@housepost.co.uk.'
      )
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[22px] tracking-[-0.01em]">Check your email</CardTitle>
          <CardDescription>
            If that email has an account, we&apos;ve sent it a link. Open the link to choose a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[14px] text-ink-2">
            Nothing there? Check your spam folder or{' '}
            <button
              type="button"
              className="font-semibold text-navy-ink underline-offset-4 hover:underline"
              onClick={() => setSubmitted(false)}
            >
              try again
            </button>
          </p>
        </CardContent>
        <CardFooter>
          <p className="text-[14px] text-ink-2">
            <Link href="/login" className="font-semibold text-navy-ink underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[22px] tracking-[-0.01em]">Reset your password</CardTitle>
        <CardDescription>We&apos;ll email you a link to set a new one.</CardDescription>
      </CardHeader>
      <form onSubmit={handleReset} className="flex flex-col gap-6">
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-[14px] leading-normal text-[#8a3324]">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending link…' : 'Send reset link'}
          </Button>
          <p className="text-[14px] text-ink-2">
            Remembered it?{' '}
            <Link href="/login" className="font-semibold text-navy-ink underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
