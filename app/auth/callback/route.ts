import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Supabase email confirmation callback.
 * When a user clicks the confirmation link in their email, Supabase redirects
 * here with a `code` query param. We exchange it for a session, then redirect
 * the user into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirect_to') ?? '/billing'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // If code exchange failed, send to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}
