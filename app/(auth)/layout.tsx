export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3">
            <Link href="/" aria-label="Housepost home"><Logo /></Link>
            <p className="text-sm text-ink-2">Target newly moved-in homeowners near you.</p>
          </div>
          {children}
        </div>
      </div>
      <SiteFooter variant="portal" />
    </div>
  )
}
