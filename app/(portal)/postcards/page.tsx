export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatMonthKey, formatDate } from '@/lib/utils/date'
import { formatAddressLine, formatPostcode } from '@/lib/address/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ChevronDown } from 'lucide-react'
import CancelOrderButton from '@/components/postcards/CancelOrderButton'
import { StatusGuide } from '@/components/postcards/StatusGuide'
import { SendAgainButton, TrackingSendProvider } from '@/components/postcards/TrackingSend'
import {
  IN_FLIGHT_JOB_STATUSES,
  statusColour,
  statusLabel,
  trackingStatus,
} from '@/components/postcards/status'

// Show the first 15 rows of each month, with the rest behind a "Show more"
// disclosure — mirrors the Previous leads table's page size.
const SECTION_PAGE_SIZE = 15

// A short line under a status when the badge alone isn't enough. A failed
// card's reason isn't shown here any more (fix list 5.3); "What do these
// mean?" explains the common reasons instead. No supplier is ever named.
const statusNotes: Record<string, string> = {
  held: 'Queued. You can cancel until it goes to print.',
  delayed: 'There is a temporary problem on our side with printing. This card will be sent automatically. Nothing more to pay.',
  refund_failed: 'This card was cancelled. The refund is being handled by our team.',
  error: 'Something went wrong after printing. Our team is looking into it.',
}

type Job = {
  id: string
  lead_id: string | null
  recipient_address_line: string
  recipient_postcode: string
  charge_amount_pence: number
  dispatched_at: string | null
  status: string
  postgrid_status: string | null
  batch_id: string | null
  lead_month: string
  created_at: string
  retry_count?: number | null
}

// A single postcard row — shared between the always-visible rows and the ones
// revealed by "Show more" so both render identically. Each row is one card
// that went (or is going) out, so an address sent to twice shows twice.
function JobRow({ job }: { job: Job }) {
  const displayStatus = trackingStatus(job)
  const note = statusNotes[displayStatus]

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 align-top">
        {/* Same title-casing as Leads (5.6), so an address reads the same everywhere. */}
        <p className="font-medium text-slate-800 break-words">{formatAddressLine(job.recipient_address_line)}</p>
        <p className="text-xs text-slate-400">{formatPostcode(job.recipient_postcode)}</p>
      </td>
      <td className="px-4 py-3 text-center text-slate-600 align-top">
        {job.charge_amount_pence === 0 ? (
          // Brand green label with navy text (5.4).
          <span className="inline-block rounded-full bg-signal px-2.5 py-0.5 text-xs font-medium text-brand">
            Included
          </span>
        ) : (
          <span className="text-xs">£{(job.charge_amount_pence / 100).toFixed(2)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 align-top">
        {job.dispatched_at ? formatDate(job.dispatched_at) : '–'}
      </td>
      <td className="px-4 py-3 text-center align-top">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColour(displayStatus)}`}>
          {statusLabel(displayStatus)}
        </span>
        {note && (
          <p className="mt-1.5 text-left text-xs leading-snug text-slate-500">{note}</p>
        )}
      </td>
      <td className="px-4 py-3 text-center align-top">
        {/* Cancel while it's still in the cool-off, and Send again on every
            card (5.5), through the same review and cool-off as Leads. */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {job.status === 'held' && job.batch_id && <CancelOrderButton orderId={job.batch_id} />}
          <SendAgainButton leadId={job.lead_id} inFlight={IN_FLIGHT_JOB_STATUSES.has(job.status)} />
        </div>
      </td>
    </tr>
  )
}

// Fixed column widths, shared by the header table and the "Show more" table so
// the two stay perfectly aligned.
function ColGroup() {
  return (
    <colgroup>
      <col className="w-[30%]" />
      <col className="w-[12%]" />
      <col className="w-[14%]" />
      <col className="w-[22%]" />
      <col className="w-[22%]" />
    </colgroup>
  )
}

export default async function PostcardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: jobsData }, { data: profile }] = await Promise.all([
    supabase
      .from('postcard_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('postcard_design_back_url').eq('id', user.id).single(),
  ])

  const jobs = (jobsData ?? []) as unknown as Job[]
  // Empty back → the send warns before a blank back goes out, as on Leads.
  const hasBackDesign = Boolean((profile?.postcard_design_back_url as string | null)?.trim())

  if (!jobs.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Tracking</h1>
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
    <TrackingSendProvider hasBackDesign={hasBackDesign}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Tracking</h1>
          <StatusGuide />
        </div>

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
                  <table className="w-full min-w-[720px] table-fixed text-sm">
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
                      <summary className="flex cursor-pointer items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors list-none [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                        <span className="group-open:hidden">Show more ({overflow.length} remaining)</span>
                        <span className="hidden group-open:inline">Show fewer</span>
                      </summary>
                      <table className="w-full min-w-[720px] table-fixed text-sm">
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
    </TrackingSendProvider>
  )
}
