'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPricePence, formatDate } from '@/lib/utils/date'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { INCLUDED_POSTCARDS_PER_MONTH } from '@/types/profile'
import type { SubscriptionStatus } from '@/types/profile'
import { ArrowUpDown, ArrowUp, ArrowDown, SendHorizonal, Trash2, Lock } from 'lucide-react'
import { toast } from 'sonner'

type Lead = {
  id: string
  address_line: string
  postcode: string
  price: number
  property_type: string
  distance_miles: number
  date_of_transfer: string
  selected_for_dispatch: boolean
  postcard_job_id: string | null
}

type SortField = 'distance' | 'price'
type SortState = 0 | 1 | 2 // 0 = neutral, 1 = primary direction, 2 = reverse direction
type Tab = 'active' | 'past'

interface LeadsTableProps {
  leads: Lead[]
  monthKey: string
  subscriptionStatus: SubscriptionStatus
}

export function LeadsTable({ leads: initialLeads, monthKey, subscriptionStatus }: LeadsTableProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [distanceSort, setDistanceSort] = useState<SortState>(0)
  const [priceSort, setPriceSort] = useState<SortState>(0)
  const [dispatching, setDispatching] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tab, setTab] = useState<Tab>('active')

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  const activeLeads = leads.filter((l) => !l.postcard_job_id)
  const pastLeads = leads.filter((l) => !!l.postcard_job_id)

  const currentLeads = tab === 'active' ? activeLeads : pastLeads

  const sorted = [...currentLeads].sort((a, b) => {
    // Distance sort
    if (distanceSort === 1) return a.distance_miles - b.distance_miles
    if (distanceSort === 2) return b.distance_miles - a.distance_miles
    // Price sort
    if (priceSort === 1) return b.price - a.price
    if (priceSort === 2) return a.price - b.price
    // Default: alphabetical by address
    return a.address_line.localeCompare(b.address_line)
  })

  const selected = activeLeads.filter((l) => l.selected_for_dispatch)
  const includedCount = Math.min(selected.length, INCLUDED_POSTCARDS_PER_MONTH)
  const overageCount = Math.max(0, selected.length - INCLUDED_POSTCARDS_PER_MONTH)

  function cycleDistance() {
    setPriceSort(0)
    setDistanceSort((prev) => ((prev + 1) % 3) as SortState)
  }

  function cyclePrice() {
    setDistanceSort(0)
    setPriceSort((prev) => ((prev + 1) % 3) as SortState)
  }

  async function toggleLead(id: string, checked: boolean) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, selected_for_dispatch: checked } : l))
    )
    await fetch(`/api/leads/${id}/select`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected: checked }),
    })
  }

  async function deselectAll() {
    const selectedIds = selected.map((l) => l.id)
    if (selectedIds.length === 0) return

    setLeads((prev) =>
      prev.map((l) =>
        selectedIds.includes(l.id) ? { ...l, selected_for_dispatch: false } : l
      )
    )

    await Promise.all(
      selectedIds.map((id) =>
        fetch(`/api/leads/${id}/select`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected: false }),
        })
      )
    )
  }

  async function deleteLeads(ids: string[]) {
    if (ids.length === 0) return
    setDeleting(true)
    const res = await fetch('/api/leads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
      toast.success(`${ids.length} lead${ids.length === 1 ? '' : 's'} deleted`)
    } else {
      toast.error('Failed to delete leads')
    }
    setDeleting(false)
  }

  async function handleDispatch() {
    if (selected.length === 0) {
      toast.error('No leads selected')
      return
    }
    setDispatching(true)
    const res = await fetch('/api/postcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: selected.map((l) => l.id), month: monthKey }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Dispatch failed')
    } else {
      toast.success(`${data.dispatched} postcard${data.dispatched === 1 ? '' : 's'} queued for dispatch!`)
      setLeads((prev) =>
        prev.map((l) =>
          selected.find((s) => s.id === l.id)
            ? { ...l, postcard_job_id: 'dispatched', selected_for_dispatch: false }
            : l
        )
      )
    }
    setDispatching(false)
  }

  function SortToggle({ label, field }: { label: string; field: SortField }) {
    const state = field === 'distance' ? distanceSort : priceSort
    const cycle = field === 'distance' ? cycleDistance : cyclePrice
    const active = state !== 0

    let Icon = ArrowUpDown
    if (state === 1) Icon = ArrowDown
    if (state === 2) Icon = ArrowUp

    return (
      <button
        onClick={cycle}
        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colours ${active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colours ${
            tab === 'active'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Active ({activeLeads.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colours ${
            tab === 'past'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Past Addresses ({pastLeads.length})
        </button>
      </div>

      {/* Controls — only show for active tab */}
      {tab === 'active' && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <SortToggle label="Distance" field="distance" />
            <SortToggle label="Price" field="price" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {selected.length} selected
              {selected.length > 0 && (
                <span className="text-slate-400">
                  {' '}· {includedCount} free
                  {overageCount > 0 && `, ${overageCount} @ £1 each = £${overageCount}`}
                </span>
              )}
            </span>
            {selected.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={deselectAll}>
                  Deselect All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deleteLeads(selected.map((l) => l.id))}
                  disabled={deleting}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {deleting ? 'Deleting…' : 'Delete Selected'}
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={handleDispatch}
              disabled={dispatching || selected.length === 0}
            >
              <SendHorizonal className="h-4 w-4 mr-1.5" />
              {dispatching ? 'Sending…' : `Send ${selected.length > 0 ? selected.length : ''} Postcard${selected.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {/* Controls for past tab */}
      {tab === 'past' && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <SortToggle label="Distance" field="distance" />
            <SortToggle label="Price" field="price" />
          </div>
          {pastLeads.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => deleteLeads(pastLeads.map((l) => l.id))}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {deleting ? 'Deleting…' : 'Clear All'}
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              {tab === 'active' && <th className="px-4 py-3 text-left w-10"></th>}
              <th className="px-4 py-3 text-left font-medium text-slate-600">Address</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Price</th>
              <th className="px-4 py-3 text-center font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Distance</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((lead, index) => {
              const isBlurred = !isSubscribed && index >= 5
              return (
                <tr
                  key={lead.id}
                  className={`hover:bg-slate-50 transition-colours ${isBlurred ? 'blur-sm pointer-events-none select-none' : ''}`}
                >
                  {tab === 'active' && (
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={lead.selected_for_dispatch}
                        onCheckedChange={(checked) => toggleLead(lead.id, !!checked)}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{lead.address_line}</p>
                    <p className="text-xs text-slate-400">{lead.postcode}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatPricePence(lead.price)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="secondary" className="text-xs">
                      {PROPERTY_TYPE_LABELS[lead.property_type as keyof typeof PROPERTY_TYPE_LABELS] ?? lead.property_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {lead.distance_miles.toFixed(1)} mi
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {formatDate(lead.date_of_transfer)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Subscription overlay for blurred leads */}
        {!isSubscribed && sorted.length > 5 && (
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white via-white/90 to-transparent flex items-end justify-center pb-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <Lock className="h-5 w-5 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Subscribe to view all leads</p>
              <Link
                href="/billing"
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colours"
              >
                View plans
              </Link>
            </div>
          </div>
        )}

        {sorted.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            {tab === 'active' ? 'No active leads for this month.' : 'No past addresses yet.'}
          </div>
        )}
      </div>
    </div>
  )
}
