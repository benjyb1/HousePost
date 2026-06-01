export const dynamic = 'force-dynamic'

import Image from 'next/image'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-2">
            <Image
              src="/logo-wordmark.png"
              alt="Housepost"
              width={600}
              height={150}
              className="h-14 w-auto"
              priority
            />
            <p className="text-sm text-slate-500">UK property lead generation</p>
          </div>
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
