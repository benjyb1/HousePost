import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { adminToken, safeEqualHex } from '@/lib/admin/token'

const PORTAL_PATHS = ['/dashboard', '/leads', '/postcards', '/billing', '/settings']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminCookie = request.cookies.get('admin-auth')?.value ?? ''
    const isAuthed = adminCookie !== '' && safeEqualHex(adminCookie, await adminToken())

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
