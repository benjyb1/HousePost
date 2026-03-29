'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MapPin, Mail, Palette, CreditCard, Settings, UserCog, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: MapPin },
  { href: '/postcards', label: 'Postcards', icon: Mail },
  { href: '/postcards/design', label: 'Postcard Design', icon: Palette },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Preferences', icon: Settings },
  { href: '/account', label: 'Account', icon: UserCog },
]

export function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center border-b border-white/10 px-5 justify-between">
        <Link href="/dashboard">
          <Image
            src="/logo-wordmark.png"
            alt="Housepost"
            width={400}
            height={100}
            className="h-8 w-auto brightness-0 invert"
          />
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="md:hidden p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-white/15 text-white font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <Image src="/logo-icon.png" alt="" width={20} height={20} className="h-4 w-4 opacity-40 brightness-0 invert" />
          <span className="text-xs text-white/40">Housepost</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden rounded-md bg-white p-2 shadow-md border border-slate-200"
      >
        <Menu className="h-5 w-5 text-slate-700" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar (slide-in) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-brand sidebar-pattern border-r border-white/10 transition-transform duration-200 md:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar (always visible) */}
      <aside className="hidden md:flex w-60 flex-col border-r border-white/10 bg-brand sidebar-pattern">
        {sidebarContent}
      </aside>
    </>
  )
}
