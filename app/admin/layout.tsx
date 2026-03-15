export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900">Housepost Admin</span>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">Internal</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
