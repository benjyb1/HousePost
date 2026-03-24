'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPricePence, formatDate } from '@/lib/utils/date'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { ArrowUpDown, ArrowUp, ArrowDown, SendHorizonal, Trash2 } from 'lucide-react'
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

type SortKey = 'distance_miles' | 'price_asc' | 'price_desc'
type Tab = 'active' | 'past'

interface LeadsTableProps {
  leads: Lead[]
  monthKey: string
}

export function LeadsTable({ leads: initialLeads, monthKey }: LeadsTableProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [sortKey, setSortKey] = useState<SortKey>('distance_miles')
  const [dispatching, setDispatching] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tab, setTab] = useState<Tab>('active')

  const activeLeads = leads.filter((l) => !l.postcard_job_id)
  const pastLeads = leads.filter((l) => !!l.postcard_job_id)

  const currentLeads = tab === 'active' ? activeLeads : pastLeads

  const sorted = [...currentLeads].sort((a, b) => {
    if (sortKey === 'distance_miles') return a.distance_miles - b.distance_miles
    if (sortKey === 'price_asc') return a.price - b.price
    return b.price - a.price
  })

  const selected = activeLeads.filter((l) => l.selected_for_dispatch)
  const includedCount = Math.min(selected.length, 10)
  const overageCount = Math.max(0, selected.length - 10)

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

  function SortButton({ label, value }: { label: string; value: SortKey }) {
    const active = sortKey === value
    return (
      <button
        onClick={() => setSortKey(value)}
        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        {label}
        {active ? (
          value === 'price_asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'active'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Active ({activeLeads.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
            <SortButton label="Distance" value="distance_miles" />
            <SortButton label="Price ↑" value="price_asc" />
            <SortButton label="Price ↓" value="price_desc" />
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
            <SortButton label="Distance" value="distance_miles" />
            <SortButton label="Price ↑" value="price_asc" />
            <SortButton label="Price ↓" value="price_desc" />
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
      <div className="rounded-lg border bg-white overflow-hidden">
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
            {sorted.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
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
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            {tab === 'active' ? 'No active leads for this month.' : 'No past addresses yet.'}
          </div>
        )}
      </div>
    </div>
  )
}
