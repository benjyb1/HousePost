import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PORTAL_PATHS = ['/dashboard', '/leads', '/postcards', '/billing', '/settings']

/**
 * Timing-safe string equality for Edge Runtime (no Node.js crypto module).
 * XOR every character pair — leaks only length if lengths differ, not content.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminCookie = request.cookies.get('admin-auth')?.value ?? ''
    const adminPassword = process.env.ADMIN_PASSWORD ?? ''
    const isAuthed = adminCookie !== '' && safeEqual(adminCookie, adminPassword)

    if (!isAuthed) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  // ── Portal routes (Supabase auth) ─────────────────────────────────────────
  const isPortalPath = PORTAL_PATHS.some((p) => pathname.startsWith(p))
  if (!isPortalPath) return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() verifies the JWT with Supabase servers — required for security
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/leads/:path*',
    '/postcards/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
}
