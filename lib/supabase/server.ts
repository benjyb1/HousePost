import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * The signed-in user for this page render, worked out once and shared by the
 * layout and the page (React `cache` lasts one request).
 *
 * getClaims() checks the session token's signature against the project's
 * published ES256 key, which supabase-js caches per server instance, so a page
 * load no longer waits on a round trip to Supabase Auth for each getUser().
 * The proxy has already refreshed an expiring session before this runs.
 * Database reads are still checked by RLS against the same token.
 */
export const getSessionUser = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  if (error || !sub) return null
  return { id: sub, email: typeof data.claims.email === 'string' ? data.claims.email : null }
})

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies cannot be set
          }
        },
      },
    }
  )
}
