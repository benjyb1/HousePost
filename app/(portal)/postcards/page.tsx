export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { currentMonthKey, formatMonthKey, formatDate } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail } from 'lucide-react'

const statusColors: Record<string, string> = {
  dispatched: 'bg-blue-100 text-blue-800',
  pending: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-400',
  // PostGrid statuses
  ready: 'bg-yellow-100 text-yellow-800',
  printing: 'bg-orange-100 text-orange-800',
  mailed: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
}

/** Map PostGrid's internal status names to user-friendly labels */
const statusLabels: Record<string, string> = {
  ready: 'Processing',
  printing: 'Printing',
  mailed: 'Mailed',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  dispatched: 'Dispatched',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export default async function PostcardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const monthKey = currentMonthKey()

  const { data: jobs } = await supabase
    .from('postcard_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Group by month
  const byMonth: Record<string, typeof jobs> = {}
  for (const job of jobs ?? []) {
    const m = job.lead_month as string
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m]!.push(job)
  }

  if (!jobs?.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Postcards</h1>
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Mail className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">No postcards sent yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Select leads from your Leads page and dispatch postcards.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Postcard Tracking</h1>
      {Object.entries(byMonth)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, monthJobs]) => (
          <Card key={month}>
            <CardHeader>
              <CardTitle className="text-base">
                {formatMonthKey(month)}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {monthJobs?.length} postcard{monthJobs?.length === 1 ? '' : 's'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Address</th>
                    <th className="px-4 py-2.5 text-center font-medium text-slate-600">Cost</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Dispatched</th>
                    <th className="px-4 py-2.5 text-center font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(monthJobs ?? []).map((job) => {
                    const displayStatus = job.postgrid_status ?? job.status
                    const colorClass = statusColors[displayStatus as string] ?? 'bg-slate-100 text-slate-600'
                    return (
                      <tr key={job.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="text-slate-800">{job.recipient_address_line as string}</p>
                          <p className="text-xs text-slate-400">{job.recipient_postcode as string}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {(job.charge_amount_pence as number) === 0 ? (
                            <span className="text-green-600 text-xs">Included</span>
                          ) : (
                            <span className="text-xs">£{((job.charge_amount_pence as number) / 100).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {job.dispatched_at ? formatDate(job.dispatched_at as string) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
                            {statusLabels[displayStatus as string] ?? (displayStatus as string).replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}
