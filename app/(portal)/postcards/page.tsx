export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatMonthKey, formatDate } from '@/lib/utils/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ChevronDown } from 'lucide-react'
import ResendButton from '@/components/postcards/ResendButton'

// Show the first 15 rows of each month, with the rest behind a "Show more"
// disclosure — mirrors the Previous leads table's page size.
const SECTION_PAGE_SIZE = 15

const statusColors: Record<string, string> = {
  dispatched: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  pending: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-400',
  received: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-yellow-100 text-yellow-800',
  production: 'bg-orange-100 text-orange-800',
  printed: 'bg-orange-100 text-orange-800',
  held: 'bg-purple-100 text-purple-800',
  error: 'bg-red-100 text-red-800',
}

// Map the pipeline's internal status keys to neutral, user-facing labels. No
// print supplier is ever named — the customer only sees where their card is.
const statusLabels: Record<string, string> = {
  received: 'Received',
  processing: 'Processing',
  production: 'Printing',
  printed: 'Printed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  held: 'On hold',
  error: 'Error',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

type Job = {
  id: string
  recipient_address_line: string
  recipient_postcode: string
  charge_amount_pence: number
  dispatched_at: string | null
  status: string
  postgrid_status: string | null
  lead_month: string
  created_at: string
}

// A single postcard row — shared between the always-visible rows and the ones
// revealed by "Show more" so both render identically.
function JobRow({ job }: { job: Job }) {
  // Stay tolerant of both columns during the postgrid_status → status
  // consolidation (see the postcard_status migration): prefer the legacy
  // column while it may still carry the freshest value.
  const displayStatus = job.postgrid_status ?? job.status
  const colorClass = statusColors[displayStatus] ?? 'bg-slate-100 text-slate-600'
  const label = statusLabels[displayStatus] ?? displayStatus.replace(/_/g, ' ')

  return (
    <tr className="hover:bg-slate-50 transition-colours">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-slate-800 break-words">{job.recipient_address_line}</p>
        <p className="text-xs text-slate-400">{job.recipient_postcode}</p>
      </td>
      <td className="px-4 py-3 text-center text-slate-600 align-top">
        {job.charge_amount_pence === 0 ? (
          <span className="text-green-600 text-xs">Included</span>
        ) : (
          <span className="text-xs">£{(job.charge_amount_pence / 100).toFixed(2)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 align-top">
        {job.dispatched_at ? formatDate(job.dispatched_at) : '–'}
      </td>
      <td className="px-4 py-3 text-center align-top">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      </td>
      <td className="px-4 py-3 text-center align-top">
        <ResendButton jobId={job.id} />
      </td>
    </tr>
  )
}

// Fixed column widths, shared by the header table and the "Show more" table so
// the two stay perfectly aligned.
function ColGroup() {
  return (
    <colgroup>
      <col className="w-[40%]" />
      <col className="w-[14%]" />
      <col className="w-[18%]" />
      <col className="w-[16%]" />
      <col className="w-[12%]" />
    </colgroup>
  )
}

export default async function PostcardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: jobsData } = await supabase
    .from('postcard_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const jobs = (jobsData ?? []) as unknown as Job[]

  if (!jobs.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Postcard Tracking</h1>
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

  // Group by the lead month, newest month first.
  const byMonth = new Map<string, Job[]>()
  for (const job of jobs) {
    const month = job.lead_month
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month)!.push(job)
  }
  const monthGroups = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Postcard Tracking</h1>

      {monthGroups.map(([month, monthJobs]) => {
        const visible = monthJobs.slice(0, SECTION_PAGE_SIZE)
        const overflow = monthJobs.slice(SECTION_PAGE_SIZE)
        const hasMore = overflow.length > 0

        return (
          <Card key={month}>
            <CardHeader>
              <CardTitle className="text-base">
                {formatMonthKey(month)}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {monthJobs.length} postcard{monthJobs.length === 1 ? '' : 's'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed text-sm">
                  <ColGroup />
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-600">Address</th>
                      <th className="px-4 py-2.5 text-center font-medium text-slate-600">Cost</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-600">Dispatched</th>
                      <th className="px-4 py-2.5 text-center font-medium text-slate-600">Status</th>
                      <th className="px-4 py-2.5 text-center font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.map((job) => (
                      <JobRow key={job.id} job={job} />
                    ))}
                  </tbody>
                </table>

                {/* Progressive disclosure for months with more than 15 cards.
                    Pure CSS via <details> keeps this a server component. */}
                {hasMore && (
                  <details className="group border-t">
                    <summary className="flex cursor-pointer items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colours list-none [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      <span className="group-open:hidden">Show more ({overflow.length} remaining)</span>
                      <span className="hidden group-open:inline">Show fewer</span>
                    </summary>
                    <table className="w-full min-w-[640px] table-fixed text-sm">
                      <ColGroup />
                      <tbody className="divide-y border-t">
                        {overflow.map((job) => (
                          <JobRow key={job.id} job={job} />
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
