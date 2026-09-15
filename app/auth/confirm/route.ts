import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Token-hash confirmation endpoint (sign-up confirmation and password reset).
 *
 * The browser client uses the PKCE flow, so a link built from
 * `{{ .ConfirmationURL }}` only works in the SAME browser that requested it —
 * open the email on your phone after asking from your laptop and the code can't
 * be exchanged ("Link expired"). Pointing the Supabase email templates here
 * instead, with `{{ .TokenHash }}`, verifies the token server-side and works
 * from any device:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/billing
 *
 * On success the session cookie is set and the user is redirected to `next`.
 * A reused or expired link lands on the same "Link expired" state the client
 * page already handles.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const nextRaw = searchParams.get('next') ?? '/dashboard'
  // Only allow same-site relative paths as the destination.
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const failure =
    type === 'recovery'
      ? '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
      : '/login?error=confirmation_failed'
  return NextResponse.redirect(`${origin}${failure}`)
}
