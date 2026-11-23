'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Success. Keep the button in its "Signing in…" state and do a full
    // navigation so the server reliably picks up the new session cookie
    // (router.push can race the cookie write and bounce back to /login).
    // loading stays true until this page unloads, so the spinner persists
    // through the redirect instead of flicking back to "Sign in".
    const requested = new URLSearchParams(window.location.search).get('redirectTo')
    const dest =
      requested && requested.startsWith('/') && !requested.startsWith('//')
        ? requested
        : '/dashboard'
    window.location.assign(dest)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[22px] tracking-[-0.01em]">Sign in</CardTitle>
      </CardHeader>
      <form onSubmit={handleLogin} className="flex flex-col gap-6">
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-[13.5px] font-semibold text-navy-ink underline-offset-4 hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-[14px] text-ink-2">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-navy-ink underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
