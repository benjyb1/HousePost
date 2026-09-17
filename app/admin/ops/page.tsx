export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPrintBalancePence, lowBalancePence, printUnitCostPence } from '@/lib/postcards/stannp-account'
import { describeCategory } from '@/lib/postcards/failure'
import { TopUpForm, RetryNowButton } from '@/components/admin/OpsActions'

type Row = {
  id: string
  user_id: string | null
  status: string
  postgrid_status: string | null
  recipient_address_line: string
  recipient_postcode: string
  release_at: string | null
  retry_count: number | null
  failure_category: string | null
  failure_reason: string | null
  last_error: string | null
  last_error_at: string | null
  failed_at: string | null
  dispatching_at: string | null
  created_at: string
  charge_amount_pence: number
  was_included_in_subscription: boolean
}

function when(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

function pounds(pence: number | null): string {
  return pence === null ? 'unknown' : `£${(pence / 100).toFixed(2)}`
}

/**
 * Operations page: the one screen an operator needs when a customer says a
 * card "failed". Print balance and top-up, delayed cards (retrying on their
 * own), recent failures with the raw supplier error, and anything stuck.
 */
export default async function OpsPage() {
  const supabase = createAdminClient()
  const nowMs = new Date().getTime()
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString()
  const tenMinAgo = new Date(nowMs - 10 * 60_000).toISOString()
  const twentyMinAgo = new Date(nowMs - 20 * 60_000).toISOString()

  const cols =
    'id, user_id, status, postgrid_status, recipient_address_line, recipient_postcode, release_at, retry_count, failure_category, failure_reason, last_error, last_error_at, failed_at, dispatching_at, created_at, charge_amount_pence, was_included_in_subscription'

  const [balancePence, delayedRes, failedRes, stuckRes, pendingRes, queuedRes] = await Promise.all([
    getPrintBalancePence(),
    supabase.from('postcard_jobs').select(cols).eq('status', 'held').gt('retry_count', 0).order('release_at', { ascending: true }).limit(200),
    supabase.from('postcard_jobs').select(cols).eq('status', 'failed').gte('failed_at', thirtyDaysAgo).order('failed_at', { ascending: false }).limit(200),
    supabase.from('postcard_jobs').select(cols).eq('status', 'dispatching').lt('dispatching_at', tenMinAgo).limit(50),
    supabase.from('postcard_jobs').select(cols).eq('status', 'pending').lt('created_at', twentyMinAgo).limit(50),
    supabase.from('postcard_jobs').select('id', { count: 'exact', head: true }).eq('status', 'held'),
  ])

  const delayed = (delayedRes.data ?? []) as Row[]
  const failed = (failedRes.data ?? []) as Row[]
  const stuck = (stuckRes.data ?? []) as Row[]
  const stuckPending = (pendingRes.data ?? []) as Row[]
  const queued = queuedRes.count ?? 0
  const low = balancePence !== null && balancePence < lowBalancePence()
  const cardsCovered = balancePence === null ? null : Math.floor(balancePence / printUnitCostPence())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
        <p className="text-sm text-slate-500">
          Print balance, delayed and failed cards, and anything stuck. Categories and next steps are
          in docs/OPERATIONS.md.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={low ? 'border-red-300 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Print balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className={`text-3xl font-bold ${low ? 'text-red-700' : 'text-slate-900'}`}>{pounds(balancePence)}</p>
            <p className="text-xs text-slate-500">
              {cardsCovered === null
                ? 'Could not reach the print account just now.'
                : `Covers about ${cardsCovered} more card${cardsCovered === 1 ? '' : 's'} at ${pounds(printUnitCostPence())} each. Alert below ${pounds(lowBalancePence())}.`}
            </p>
            <TopUpForm />
            <p className="text-xs text-slate-400">
              Charges the card saved on the print account. Keep auto top-up on there so this is rarely needed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Queued to print</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{queued}</p>
            <p className="text-xs text-slate-500">held cards, including {delayed.length} delayed</p>
          </CardContent>
        </Card>

        <Card className={stuck.length + stuckPending.length > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Needs a human</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{stuck.length + stuckPending.length}</p>
            <p className="text-xs text-slate-500">
              {stuck.length} stuck sending, {stuckPending.length} stuck pending (ambiguous charge)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Delayed <span className="ml-2 text-sm font-normal text-slate-400">{delayed.length}</span>
          </CardTitle>
          <RetryNowButton count={delayed.length} />
        </CardHeader>
        <CardContent className="p-0">
          {delayed.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">Nothing delayed. Cards here retry on their own once the problem clears.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Address</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Retries</th>
                    <th className="px-4 py-2">Next try</th>
                    <th className="px-4 py-2">Raw error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {delayed.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        <p className="text-slate-800">{r.recipient_address_line}</p>
                        <p className="text-xs text-slate-400">{r.recipient_postcode} · {r.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-2">{describeCategory(r.failure_category)}</td>
                      <td className="px-4 py-2">{r.retry_count ?? 0}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{when(r.release_at)}</td>
                      <td className="px-4 py-2"><code className="text-xs text-slate-600">{r.last_error ?? '–'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Failed in the last 30 days <span className="ml-2 text-sm font-normal text-slate-400">{failed.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {failed.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">No failures.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Address</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">Paid</th>
                    <th className="px-4 py-2">Raw error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {failed.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        <p className="text-slate-800">{r.recipient_address_line}</p>
                        <p className="text-xs text-slate-400">{r.recipient_postcode} · {r.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-2">{describeCategory(r.failure_category)}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{when(r.failed_at ?? r.last_error_at)}</td>
                      <td className="px-4 py-2 text-xs">
                        {r.was_included_in_subscription ? 'Included' : `£${(r.charge_amount_pence / 100).toFixed(2)}${r.postgrid_status === 'refund_failed' ? ' (refund FAILED)' : ' (refunded)'}`}
                      </td>
                      <td className="px-4 py-2"><code className="text-xs text-slate-600">{r.last_error ?? '–'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(stuck.length > 0 || stuckPending.length > 0) && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base">Stuck: check before touching</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {stuck.length > 0 && (
              <div>
                <p className="font-medium text-slate-800">In &lsquo;sending&rsquo; for over 10 minutes</p>
                <p className="text-xs text-slate-500">
                  The print request may or may not have gone through. Check the print account for the address before
                  marking these dispatched or failed. They are never retried automatically.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {stuck.map((r) => (
                    <li key={r.id}><code>{r.id}</code> · {r.recipient_address_line}, {r.recipient_postcode} · since {when(r.dispatching_at)}</li>
                  ))}
                </ul>
              </div>
            )}
            {stuckPending.length > 0 && (
              <div>
                <p className="font-medium text-slate-800">In &lsquo;pending&rsquo; for over 20 minutes</p>
                <p className="text-xs text-slate-500">
                  A card charge came back ambiguous. Check Stripe for the batch before releasing, refunding or
                  freeing the leads.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {stuckPending.map((r) => (
                    <li key={r.id}><code>{r.id}</code> · {r.recipient_address_line}, {r.recipient_postcode} · since {when(r.created_at)}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
