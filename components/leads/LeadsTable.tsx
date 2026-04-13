'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPricePence, formatDate, formatMonthKey } from '@/lib/utils/date'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { INCLUDED_POSTCARDS_PER_MONTH } from '@/types/profile'
import type { SubscriptionStatus } from '@/types/profile'
import {
  ArrowUpDown, ArrowUp, ArrowDown, SendHorizonal,
  Archive, Lock, ChevronDown, ChevronUp,
} from 'lucide-react'
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
  lead_month: string
  archived_at: string | null
}

type SortField = 'distance' | 'price' | 'type' | 'date'
type SortState = 0 | 1 | 2
type Tab = 'active' | 'past' | 'archived'

const SECTION_PAGE_SIZE = 15

interface LeadsTableProps {
  leads: Lead[]
  subscriptionStatus: SubscriptionStatus
}

export function LeadsTable({ leads: initialLeads, subscriptionStatus }: LeadsTableProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [archivedLeads, setArchivedLeads] = useState<Lead[]>([])
  const [archivedLoaded, setArchivedLoaded] = useState(false)
  const [distanceSort, setDistanceSort] = useState<SortState>(0)
  const [priceSort, setPriceSort] = useState<SortState>(0)
  const [typeSort, setTypeSort] = useState<SortState>(0)
  const [dateSort, setDateSort] = useState<SortState>(0)
  const [dispatching, setDispatching] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [tab, setTab] = useState<Tab>('active')
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  const activeLeads = leads.filter((l) => !l.postcard_job_id)
  const pastLeads = leads.filter((l) => !!l.postcard_job_id)

  const currentLeads =
    tab === 'active' ? activeLeads :
    tab === 'past' ? pastLeads :
    archivedLeads

  // --- Sorting ---

  function sortLeads(list: Lead[]): Lead[] {
    return [...list].sort((a, b) => {
      if (distanceSort === 1) return a.distance_miles - b.distance_miles
      if (distanceSort === 2) return b.distance_miles - a.distance_miles
      if (priceSort === 1) return b.price - a.price
      if (priceSort === 2) return a.price - b.price
      if (typeSort === 1) return a.property_type.localeCompare(b.property_type)
      if (typeSort === 2) return b.property_type.localeCompare(a.property_type)
      if (dateSort === 1) return new Date(b.date_of_transfer).getTime() - new Date(a.date_of_transfer).getTime()
      if (dateSort === 2) return new Date(a.date_of_transfer).getTime() - new Date(b.date_of_transfer).getTime()
      return a.address_line.localeCompare(b.address_line)
    })
  }

  // --- Group by month ---

  function groupByMonth(list: Lead[]): { month: string; leads: Lead[] }[] {
    const map = new Map<string, Lead[]>()
    for (const lead of list) {
      const key = lead.lead_month
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(lead)
    }
    // Sort months newest first
    const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    return entries.map(([month, leads]) => ({ month, leads: sortLeads(leads) }))
  }

  const monthGroups = groupByMonth(currentLeads)

  // --- Selection ---

  const selected = activeLeads.filter((l) => l.selected_for_dispatch)
  const includedCount = Math.min(selected.length, INCLUDED_POSTCARDS_PER_MONTH)
  const overageCount = Math.max(0, selected.length - INCLUDED_POSTCARDS_PER_MONTH)

  function resetSorts() {
    setDistanceSort(0)
    setPriceSort(0)
    setTypeSort(0)
    setDateSort(0)
  }

  function cycleDistance() {
    resetSorts()
    setDistanceSort((prev) => ((prev + 1) % 3) as SortState)
  }

  function cyclePrice() {
    resetSorts()
    setPriceSort((prev) => ((prev + 1) % 3) as SortState)
  }

  function cycleType() {
    resetSorts()
    setTypeSort((prev) => ((prev + 1) % 3) as SortState)
  }

  function cycleDate() {
    resetSorts()
    setDateSort((prev) => ((prev + 1) % 3) as SortState)
  }

  async function switchTab(t: Tab) {
    setTab(t)
    setExpandedMonths({})

    // Lazy-load archived leads on first visit
    if (t === 'archived' && !archivedLoaded) {
      const res = await fetch('/api/leads?archived=true')
      if (res.ok) {
        const data = await res.json()
        setArchivedLeads(data.leads ?? [])
      }
      setArchivedLoaded(true)
    }
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

  async function selectAll() {
    const toSelect = isSubscribed
      ? activeLeads.filter((l) => !l.selected_for_dispatch)
      : activeLeads.filter((l) => !l.selected_for_dispatch).slice(0, 5 - selected.length)

    if (toSelect.length === 0) return

    const ids = toSelect.map((l) => l.id)
    setLeads((prev) =>
      prev.map((l) => (ids.includes(l.id) ? { ...l, selected_for_dispatch: true } : l))
    )

    await Promise.all(
      ids.map((id) =>
        fetch(`/api/leads/${id}/select`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected: true }),
        })
      )
    )
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

  async function archiveLeads(ids: string[]) {
    if (ids.length === 0) return
    setArchiving(true)
    const res = await fetch('/api/leads/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      const now = new Date().toISOString()
      // Move to archived
      const archived = leads.filter((l) => ids.includes(l.id)).map((l) => ({ ...l, archived_at: now }))
      setArchivedLeads((prev) => [...archived, ...prev])
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)))
      toast.success(`${ids.length} lead${ids.length === 1 ? '' : 's'} archived`)
    } else {
      toast.error('Failed to archive leads')
    }
    setArchiving(false)
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
      body: JSON.stringify({ leadIds: selected.map((l) => l.id) }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Dispatch failed')
    } else if (data.failed > 0) {
      toast.error(`${data.failed} postcard${data.failed === 1 ? '' : 's'} failed, ${data.dispatched} sent`)
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

  function toggleMonthExpanded(month: string) {
    setExpandedMonths((prev) => ({ ...prev, [month]: !prev[month] }))
  }

  // --- Sub-components ---

  function SortToggle({ label, field }: { label: string; field: SortField }) {
    const stateMap = { distance: distanceSort, price: priceSort, type: typeSort, date: dateSort }
    const cycleMap = { distance: cycleDistance, price: cyclePrice, type: cycleType, date: cycleDate }
    const state = stateMap[field]
    const cycle = cycleMap[field]
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

  function LeadRow({ lead, index, showCheckbox }: { lead: Lead; index: number; showCheckbox: boolean }) {
    const isBlurred = !isSubscribed && index >= 5

    return (
      <tr
        className={`hover:bg-slate-50 transition-colours ${isBlurred ? 'blur-sm pointer-events-none select-none' : ''}`}
      >
        {showCheckbox && (
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
  }

  const showCheckbox = tab === 'active'
  const colCount = showCheckbox ? 7 : 6

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          ['active', `Active (${activeLeads.length})`],
          ['past', `Past Addresses (${pastLeads.length})`],
          ['archived', `Archived${archivedLoaded ? ` (${archivedLeads.length})` : ''}`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colours ${
              tab === key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Controls — active tab */}
      {tab === 'active' && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <SortToggle label="Price" field="price" />
            <SortToggle label="Type" field="type" />
            <SortToggle label="Distance" field="distance" />
            <SortToggle label="Date" field="date" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {selected.length} selected
              {selected.length > 0 && (
                <span className="text-slate-400">
                  {' '}&middot; {includedCount} free
                  {overageCount > 0 && `, ${overageCount} @ £1.50 each = £${(overageCount * 1.5).toFixed(2)}`}
                </span>
              )}
            </span>
            <Button size="sm" variant="outline" onClick={selectAll}>
              Select All
            </Button>
            {selected.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={deselectAll}>
                  Deselect All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => archiveLeads(selected.map((l) => l.id))}
                  disabled={archiving}
                >
                  <Archive className="h-3.5 w-3.5 mr-1" />
                  {archiving ? 'Archiving…' : 'Archive Selected'}
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

      {/* Controls — past tab */}
      {tab === 'past' && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <SortToggle label="Price" field="price" />
            <SortToggle label="Type" field="type" />
            <SortToggle label="Distance" field="distance" />
            <SortToggle label="Date" field="date" />
          </div>
          {pastLeads.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => archiveLeads(pastLeads.map((l) => l.id))}
              disabled={archiving}
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              {archiving ? 'Archiving…' : 'Archive All'}
            </Button>
          )}
        </div>
      )}

      {/* Controls — archived tab */}
      {tab === 'archived' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort by:</span>
          <SortToggle label="Distance" field="distance" />
          <SortToggle label="Price" field="price" />
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              {showCheckbox && <th className="px-4 py-3 text-left w-10"></th>}
              <th className="px-4 py-3 text-left font-medium text-slate-600">Address</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Price</th>
              <th className="px-4 py-3 text-center font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Distance</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {monthGroups.map(({ month, leads: monthLeads }) => {
              const isExpanded = !!expandedMonths[month]
              const visibleLeads = isExpanded ? monthLeads : monthLeads.slice(0, SECTION_PAGE_SIZE)
              const hasMore = monthLeads.length > SECTION_PAGE_SIZE

              return (
                <MonthSection key={month}>
                  {/* Month header */}
                  <tr className="bg-slate-100">
                    <td colSpan={colCount} className="px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {formatMonthKey(month)}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {monthLeads.length} {monthLeads.length === 1 ? 'lead' : 'leads'}
                      </span>
                    </td>
                  </tr>

                  {visibleLeads.map((lead, index) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      index={index}
                      showCheckbox={showCheckbox}
                    />
                  ))}

                  {/* Show more / Collapse */}
                  {hasMore && (
                    <tr>
                      <td colSpan={colCount} className="px-4 py-2 text-center">
                        <button
                          onClick={() => toggleMonthExpanded(month)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colours"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" />
                              Collapse
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              Show more ({monthLeads.length - SECTION_PAGE_SIZE} remaining)
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  )}
                </MonthSection>
              )
            })}
          </tbody>
        </table>

        {/* Subscription overlay */}
        {!isSubscribed && currentLeads.length > 5 && (
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

        {currentLeads.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            {tab === 'active' && 'No active leads yet.'}
            {tab === 'past' && 'No past addresses yet.'}
            {tab === 'archived' && 'No archived leads.'}
          </div>
        )}
      </div>
    </div>
  )
}

/** Wrapper fragment for month sections — just passes children through */
function MonthSection({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
