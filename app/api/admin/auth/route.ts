import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { ADMIN_SESSION_MS, adminConfigured, createAdminToken } from '@/lib/admin/token'
import { afterFailedAttempt, clientIp, isLockedOut, readAttempts, writeAttempts } from '@/lib/admin/attempts'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  // No password configured: admin stays shut rather than accepting a guessable token.
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'Admin is not set up on this deployment.' }, { status: 503 })
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: unknown }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const ip = clientIp(request)
  let attempts = null
  try {
    attempts = await readAttempts(supabase, ip)
  } catch (err) {
    // Fail closed: if we can't count attempts, don't take guesses.
    console.error('[admin/auth]', err)
    return NextResponse.json({ error: 'Try again in a minute.' }, { status: 503 })
  }
  const now = Date.now()
  if (isLockedOut(attempts, now)) {
    return NextResponse.json({ error: 'Too many wrong passwords. Try again in 15 minutes.' }, { status: 429 })
  }

  // Compare fixed-length digests so neither the length nor the content leaks through timing.
  const digest = (v: string) => createHash('sha256').update(v).digest()
  const match = timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD ?? ''))

  if (!match) {
    await writeAttempts(supabase, ip, afterFailedAttempt(attempts, now))
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  if (attempts) await writeAttempts(supabase, ip, null)
  const response = NextResponse.json({ success: true })
  response.cookies.set('admin-auth', await createAdminToken(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_MS / 1000,
    path: '/',
  })

  return response
}
