import Link from 'next/link'
import Image from 'next/image'

/**
 * Shared marketing footer. Used on the homepage and the public (auth) pages.
 * Both columns share the same vertical rhythm: a logo-height block at the top,
 * then a single attribution line, then two stacked links — so the right column
 * lines up row-for-row with the left (attribution ↔ copyright, privacy ↔ login,
 * terms ↔ sign up).
 */
export function SiteFooter() {
  return (
    <footer className="border-t py-12">
      <div className="mx-auto max-w-6xl px-6 flex flex-col gap-8 sm:flex-row sm:justify-between">
        {/* Left */}
        <div className="flex flex-col gap-3">
          <Image
            src="/logo-wordmark.png"
            alt="Housepost"
            width={600}
            height={150}
            className="h-10 w-auto"
          />
          <p className="text-xs text-slate-400">Copyright &copy; 2026 | Housepost</p>
          <div className="flex flex-col gap-1 text-sm text-slate-500">
            <Link href="/login" className="hover:text-slate-700 transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-slate-700 transition-colors">Sign up</Link>
          </div>
        </div>

        {/* Right — mirrors the left column's rows */}
        <div className="flex flex-col gap-3 sm:items-end sm:text-right">
          <div className="h-10" aria-hidden="true" />
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
