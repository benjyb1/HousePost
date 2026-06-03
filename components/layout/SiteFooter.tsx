import Link from 'next/link'
import Image from 'next/image'

/**
 * Shared site footer. Both columns share the same vertical rhythm: a logo-height
 * block at the top, then a single attribution line, then two stacked links — so
 * the right column lines up row-for-row with the left.
 *
 * `variant` swaps the left-column links for the context:
 *  - "public" (homepage, auth pages): Login / Sign up
 *  - "portal" (signed-in app): Dashboard / Account
 */
export function SiteFooter({ variant = 'public' }: { variant?: 'public' | 'portal' }) {
  const leftLinks =
    variant === 'portal'
      ? [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/account', label: 'Account' },
        ]
      : [
          { href: '/login', label: 'Login' },
          { href: '/signup', label: 'Sign up' },
        ]

  return (
    <footer className="border-t py-12">
      <div className="mx-auto max-w-6xl px-6 flex flex-col gap-5 sm:flex-row sm:justify-between sm:gap-8">
        {/* Left */}
        <div className="flex flex-col gap-3">
          {/* On mobile the logo fills the column width but keeps its aspect
              ratio (h-auto); from sm up it's a fixed height. */}
          <Image
            src="/logo-wordmark.png"
            alt="Housepost"
            width={600}
            height={150}
            className="h-auto w-full max-w-xs sm:h-10 sm:w-auto sm:max-w-none"
          />
          <p className="text-xs text-slate-400">Copyright &copy; 2026 | Housepost</p>
          <div className="flex flex-col gap-1 text-sm text-slate-500">
            {leftLinks.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-slate-700 transition-colors">{label}</Link>
            ))}
          </div>
        </div>

        {/* Right — mirrors the left column's rows */}
        <div className="flex flex-col gap-3 sm:items-end sm:text-right">
          {/* Spacer matches the logo height so rows line up when the columns sit
              side by side. Hidden on mobile, where it would just add dead space
              between the two stacked sections. */}
          <div className="hidden h-10 sm:block" aria-hidden="true" />
          <p className="text-xs text-slate-400">
            Data sourced from HM Land Registry &middot; Printed by PostGrid
          </p>
          <div className="flex flex-col gap-1 text-sm text-slate-500 sm:items-end">
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy policy</Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms and conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
