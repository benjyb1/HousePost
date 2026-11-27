import { createClient } from '@/lib/supabase/client'

export type SignOutResult = 'signed-out' | 'this-browser-only' | 'failed'

/** Supabase keeps the session in `sb-<project>-auth-token` cookies (split into .0, .1… when long). */
function clearSessionCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name && /^sb-.+-auth-token(\.\d+)?$/.test(name)) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
    }
  }
}

/**
 * Sign out of Housepost in the browser.
 *
 * Asks Supabase to end the session ('global' for every device, 'local' for
 * this one). If Supabase can't be reached (offline, an outage), supabase-js
 * returns an error and keeps the session, which used to leave people on the
 * sign-in page while still signed in. So we then clear this browser's session
 * cookies ourselves and check they've gone.
 *
 *  - 'signed-out': done.
 *  - 'this-browser-only': this browser is signed out, but the session couldn't
 *    be ended on the server.
 *  - 'failed': still signed in here. Tell the person; don't pretend.
 */
export async function signOutOfHousepost(scope: 'global' | 'local' = 'global'): Promise<SignOutResult> {
  const supabase = createClient()
  try {
    const { error } = await supabase.auth.signOut({ scope })
    if (!error) return 'signed-out'
    console.error('Sign-out failed, clearing this browser’s session instead:', error.message)
  } catch (err) {
    console.error('Sign-out failed, clearing this browser’s session instead:', err)
  }
  try {
    clearSessionCookies()
    const { data } = await createClient().auth.getSession()
    return data.session ? 'failed' : 'this-browser-only'
  } catch {
    return 'failed'
  }
}
