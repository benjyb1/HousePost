export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-slate-900">Housepost Admin</span>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/admin" className="hover:text-slate-900">Clients</Link>
              <Link href="/admin/ops" className="hover:text-slate-900">Operations</Link>
            </nav>
          </div>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">Internal</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      <SiteFooter variant="portal" />
    </div>
  )
}
