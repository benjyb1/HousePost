export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'

interface Client {
  id: string
  full_name: string
  email: string
  office_postcode: string
  subscription_status: string
  subscription_period_end: string | null
  postcards_used_this_period: number
  created_at: string
  totalLeads: number
  totalPostcards: number
}

async function getClients(): Promise<Client[]> {
  const supabase = createAdminClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, office_postcode, subscription_status, subscription_period_end, postcards_used_this_period, created_at')
    .order('created_at', { ascending: false })

  if (!profiles) return []

  const enriched = await Promise.all(
    profiles.map(async (p) => {
      const [{ count: leadCount }, { count: postcardCount }] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
        supabase.from('postcard_jobs').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
      ])
      return { ...p, totalLeads: leadCount ?? 0, totalPostcards: postcardCount ?? 0 } as Client
    })
  )

  return enriched
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-amber-100 text-amber-800',
  canceled: 'bg-red-100 text-red-800',
  incomplete: 'bg-slate-100 text-slate-500',
}

export default async function AdminPage() {
  const clients = await getClients()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <p className="text-sm text-slate-500">{clients.length} total accounts</p>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Client</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Postcode</th>
              <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Total leads</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Total postcards</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Used this period</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{client.full_name || '—'}</p>
                  <p className="text-xs text-slate-400">{client.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{client.office_postcode || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[client.subscription_status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {client.subscription_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{client.totalLeads.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-700">{client.totalPostcards}</td>
                <td className="px-4 py-3 text-right text-slate-700">{client.postcards_used_this_period}/10</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(client.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <div className="py-12 text-center text-slate-400">No clients yet</div>
        )}
      </div>
    </div>
  )
}
