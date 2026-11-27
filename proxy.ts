import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdminToken } from '@/lib/admin/token'

const PORTAL_PATHS = ['/dashboard', '/leads', '/postcards', '/billing', '/settings', '/account', '/notifications']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // Signed, unexpired token only; always false when ADMIN_PASSWORD is unset.
    const isAuthed = await verifyAdminToken(request.cookies.get('admin-auth')?.value)

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

  // getClaims() refreshes an expiring session (writing the new cookies above)
  // and checks the token's signature against the project's published ES256
  // key, cached per server instance. getUser() asked Supabase Auth over the
  // network on every page load, and the layout and page then asked again.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims?.sub ? data.claims : null

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
    '/account/:path*',
    '/notifications/:path*',
    '/admin/:path*',
  ],
}
