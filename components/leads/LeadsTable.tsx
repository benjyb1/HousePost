'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPricePence, formatDate, formatDayMonth, formatMonthKey } from '@/lib/utils/date'
import { formatAddressLine, formatPostcode } from '@/lib/address/format'
import { addressKey } from '@/lib/address/normalise'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { INCLUDED_POSTCARDS_PER_MONTH } from '@/types/profile'
import type { SubscriptionStatus } from '@/types/profile'
import {
  ArrowUpDown, ArrowUp, ArrowDown, SendHorizonal,
  Archive, ArchiveRestore, Lock, ChevronDown, ChevronUp, Plus, RotateCw,
  Info, SlidersHorizontal,
} from 'lucide-react'
import AddAddressModal from './AddAddressModal'
import { useSendFlow } from '@/components/postcards/SendFlow'
import { toast } from 'sonner'

type Lead = {
  id: string
  address_line: string
  postcode: string
  price: number | null
  property_type: string | null
  distance_miles: number | null
  date_of_transfer: string | null
  selected_for_dispatch: boolean
  postcard_job_id: string | null
  lead_month: string
  archived_at: string | null
  unarchived_at?: string | null
  is_custom: boolean
  created_at?: string | null
}

type SortField = 'distance' | 'price' | 'type' | 'date'
type SortState = 0 | 1 | 2
type Tab = 'new' | 'previous' | 'targeted' | 'archived'

const SECTION_PAGE_SIZE = 15

interface LeadsTableProps {
  leads: Lead[]
  subscriptionStatus: SubscriptionStatus
  /** False when no back design is set, so the send warns before a blank back goes out. */
  hasBackDesign: boolean
}

export function LeadsTable({ leads: initialLeads, subscriptionStatus, hasBackDesign }: LeadsTableProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [archivedLeads, setArchivedLeads] = useState<Lead[]>([])
  const [archivedLoaded, setArchivedLoaded] = useState(false)
  const [distanceSort, setDistanceSort] = useState<SortState>(0)
  const [priceSort, setPriceSort] = useState<SortState>(0)
  const [typeSort, setTypeSort] = useState<SortState>(0)
  const [dateSort, setDateSort] = useState<SortState>(0)
  const [archiving, setArchiving] = useState(false)
  const [unarchiving, setUnarchiving] = useState(false)
  const [tab, setTab] = useState<Tab>('new')
  // Per-month count of currently revealed rows — "Show more" bumps this in
  // place (see revealMore) rather than jumping to a fully-expanded list.
  const [monthVisible, setMonthVisible] = useState<Record<string, number>>({})
  const [showAddAddress, setShowAddAddress] = useState(false)
  // Local selection for the "Send again" tab (targeted leads carry no
  // selected_for_dispatch flag of their own once sent).
  const [againSelected, setAgainSelected] = useState<Set<string>>(new Set())
  // Local selection for the "Archived" tab (fix list 4.4).
  const [archivedSelected, setArchivedSelected] = useState<Set<string>>(new Set())
  // Job links the held leads had before this order, for reverting on cancel.
  const previousJobLinks = useRef<Map<string, string | null>>(new Map())

  // Review order → confirm → cool-off/cancel, shared with Tracking.
  const sendFlow = useSendFlow({
    hasBackDesign,
    // Optimistically move the held leads into "Send again" (they now carry a
    // job) and clear any selection state. Cancelling reverts this, so
    // remember what each lead pointed at before.
    onHeld: ({ orderId, leadIds }) => {
      setLeads((prev) => {
        previousJobLinks.current = new Map(
          prev.filter((l) => leadIds.includes(l.id)).map((l) => [l.id, l.postcard_job_id])
        )
        return prev.map((l) =>
          leadIds.includes(l.id) ? { ...l, postcard_job_id: orderId, selected_for_dispatch: false } : l
        )
      })
      setAgainSelected(new Set())
    },
    // Revert the optimistic hold. A re-sent lead keeps its old job link (it
    // goes back to "Send again"); a fresh one is freed.
    onCancelled: ({ leadIds, reactivate }) => {
      setLeads((prev) =>
        prev.map((l) =>
          leadIds.includes(l.id)
            ? {
                ...l,
                postcard_job_id: reactivate ? (previousJobLinks.current.get(l.id) ?? null) : null,
                selected_for_dispatch: false,
              }
            : l
        )
      )
    },
  })

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  // Collapse duplicate addresses to a single record. "1 TOLPUDDLE ST" and
  // "1 TOLPUDDLE STREET" (same postcode) share an addressKey, so they would
  // otherwise show, and be billable, twice. We keep one row per key, preferring
  // a lead that is already selected so a collapse never silently drops the user's
  // pick; otherwise the first occurrence (lists arrive newest/closest first). The
  // key folds street-type abbreviations and casing but keeps the full postcode
  // and every address token, so genuinely different addresses never merge.
  function dedupeByAddress(list: Lead[]): Lead[] {
    const byKey = new Map<string, Lead>()
    for (const lead of list) {
      const key = addressKey(lead.address_line, lead.postcode)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, lead)
      } else if (!existing.selected_for_dispatch && lead.selected_for_dispatch) {
        byKey.set(key, lead)
      }
    }
    return [...byKey.values()]
  }

  // "New leads" = your most recent batch. Leads drop on the 6th, so the newest
  // batch must stay "new" until the next drop; keying off the calendar month
  // would empty it at the start of every month. A lead added by hand or
  // unarchived joins that batch (see latestBatchMonth). "Previous leads" =
  // everything older. "Send again" = ones a postcard has already been sent to.
  const activeLeads = dedupeByAddress(leads.filter((l) => !l.postcard_job_id))
  const latestActiveMonth = [...new Set(activeLeads.map((l) => l.lead_month))].sort().pop()
  const newLeads = activeLeads.filter((l) => l.lead_month === latestActiveMonth)
  const previousLeads = activeLeads.filter((l) => l.lead_month !== latestActiveMonth)
  const targetedLeads = dedupeByAddress(leads.filter((l) => !!l.postcard_job_id))
  const dedupedArchived = dedupeByAddress(archivedLeads)

  const currentLeads =
    tab === 'new' ? newLeads :
    tab === 'previous' ? previousLeads :
    tab === 'targeted' ? targetedLeads :
    dedupedArchived

  // --- Sorting ---

  function sortLeads(list: Lead[]): Lead[] {
    return [...list].sort((a, b) => {
      if (distanceSort === 1) return (a.distance_miles ?? Infinity) - (b.distance_miles ?? Infinity)
      if (distanceSort === 2) return (b.distance_miles ?? -1) - (a.distance_miles ?? -1)
      if (priceSort === 1) return (b.price ?? 0) - (a.price ?? 0)
      if (priceSort === 2) return (a.price ?? 0) - (b.price ?? 0)
      // Null/custom property types always sort to the end, in both directions.
      if (typeSort) {
        const at = a.property_type
        const bt = b.property_type
        if (at == null && bt == null) return 0
        if (at == null) return 1
        if (bt == null) return -1
        return typeSort === 1 ? at.localeCompare(bt) : bt.localeCompare(at)
      }
      if (dateSort === 1) return new Date(b.date_of_transfer ?? 0).getTime() - new Date(a.date_of_transfer ?? 0).getTime()
      if (dateSort === 2) return new Date(a.date_of_transfer ?? 0).getTime() - new Date(b.date_of_transfer ?? 0).getTime()
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

  // --- Selection (new / previous tabs) ---

  const selected = activeLeads.filter((l) => l.selected_for_dispatch)
  const includedCount = Math.min(selected.length, INCLUDED_POSTCARDS_PER_MONTH)
  const overageCount = Math.max(0, selected.length - INCLUDED_POSTCARDS_PER_MONTH)

  const sortStates: Record<SortField, SortState> = {
    distance: distanceSort,
    price: priceSort,
    type: typeSort,
    date: dateSort,
  }

  // Click a column header to cycle its sort: off → descending → ascending → off.
  // Read the clicked field's current state first, then set all four in one go
  // (resetting then incrementing in separate calls always landed back on 1).
  function cycleSort(field: SortField) {
    const next = (((sortStates[field] + 1) % 3) as SortState)
    setDistanceSort(field === 'distance' ? next : 0)
    setPriceSort(field === 'price' ? next : 0)
    setTypeSort(field === 'type' ? next : 0)
    setDateSort(field === 'date' ? next : 0)
  }

  async function switchTab(t: Tab) {
    setTab(t)
    setMonthVisible({})
    setAgainSelected(new Set())
    setArchivedSelected(new Set())

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
    try {
      const res = await fetch(`/api/leads/${id}/select`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: checked }),
      })
      if (!res.ok) throw new Error('request failed')
    } catch {
      // Roll back so the checkbox can't silently disagree with the database.
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, selected_for_dispatch: !checked } : l))
      )
      toast.error('Could not update that selection. Please try again.')
    }
  }

  // Patch one lead's selection, returning whether it succeeded (no throw).
  async function patchSelection(id: string, selectedValue: boolean): Promise<boolean> {
    try {
      const res = await fetch(`/api/leads/${id}/select`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: selectedValue }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async function selectAll() {
    // Only the leads on the tab in front of the user: "Select All" on New
    // leads must not silently sweep up (and bill for) every Previous lead too.
    const tabLeads = tab === 'previous' ? previousLeads : newLeads
    const toSelect = isSubscribed
      ? tabLeads.filter((l) => !l.selected_for_dispatch)
      : tabLeads.filter((l) => !l.selected_for_dispatch).slice(0, 5 - selected.length)

    if (toSelect.length === 0) return

    const ids = toSelect.map((l) => l.id)
    setLeads((prev) =>
      prev.map((l) => (ids.includes(l.id) ? { ...l, selected_for_dispatch: true } : l))
    )

    const results = await Promise.all(ids.map((id) => patchSelection(id, true)))
    const failedIds = ids.filter((_, i) => !results[i])
    if (failedIds.length > 0) {
      // Roll back only the ones that didn't persist.
      setLeads((prev) =>
        prev.map((l) => (failedIds.includes(l.id) ? { ...l, selected_for_dispatch: false } : l))
      )
      toast.error('Some leads could not be selected. Please try again.')
    }
  }

  async function deselectAll() {
    const selectedIds = selected.map((l) => l.id)
    if (selectedIds.length === 0) return

    setLeads((prev) =>
      prev.map((l) =>
        selectedIds.includes(l.id) ? { ...l, selected_for_dispatch: false } : l
      )
    )

    const results = await Promise.all(selectedIds.map((id) => patchSelection(id, false)))
    const failedIds = selectedIds.filter((_, i) => !results[i])
    if (failedIds.length > 0) {
      setLeads((prev) =>
        prev.map((l) => (failedIds.includes(l.id) ? { ...l, selected_for_dispatch: true } : l))
      )
      toast.error('Some leads could not be deselected. Please try again.')
    }
  }

  // --- "Send again" and "Archived" selection (local only) ---

  function toggleIn(setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    return (id: string, checked: boolean) =>
      setter((prev) => {
        const next = new Set(prev)
        if (checked) next.add(id)
        else next.delete(id)
        return next
      })
  }
  const toggleAgain = toggleIn(setAgainSelected)
  const toggleArchived = toggleIn(setArchivedSelected)

  function selectAllAgain() {
    if (againSelected.size === targetedLeads.length) {
      setAgainSelected(new Set())
    } else {
      setAgainSelected(new Set(targetedLeads.map((l) => l.id)))
    }
  }

  function selectAllArchived() {
    if (archivedSelected.size === dedupedArchived.length) {
      setArchivedSelected(new Set())
    } else {
      setArchivedSelected(new Set(dedupedArchived.map((l) => l.id)))
    }
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

  // Bring archived leads back (fix list 4.4). Unsent ones rejoin the newest
  // batch, so they land in New leads with an "Unarchived" label; sent ones go
  // back under Send again.
  async function unarchiveLeads(ids: string[]) {
    if (ids.length === 0) return
    // Archived rows are de-duplicated for display, so bring back any hidden
    // copies of the same address too; otherwise one would pop up in its place.
    const keys = new Set(
      archivedLeads.filter((l) => ids.includes(l.id)).map((l) => addressKey(l.address_line, l.postcode))
    )
    const allIds = archivedLeads
      .filter((l) => keys.has(addressKey(l.address_line, l.postcode)))
      .map((l) => l.id)

    setUnarchiving(true)
    try {
      const res = await fetch('/api/leads/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: allIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unarchive failed')

      const months = new Map(
        (data.unarchived as { id: string; lead_month: string }[]).map((u) => [u.id, u.lead_month])
      )
      const restored = archivedLeads
        .filter((l) => months.has(l.id))
        .map((l) => ({
          ...l,
          archived_at: null,
          unarchived_at: data.unarchivedAt as string,
          lead_month: months.get(l.id)!,
          selected_for_dispatch: l.postcard_job_id ? l.selected_for_dispatch : false,
        }))
      setLeads((prev) => [...restored, ...prev])
      setArchivedLeads((prev) => prev.filter((l) => !months.has(l.id)))
      setArchivedSelected(new Set())
      toast.success(`${ids.length} lead${ids.length === 1 ? '' : 's'} unarchived`)
    } catch {
      toast.error('Could not unarchive those leads. Please try again.')
    } finally {
      setUnarchiving(false)
    }
  }

  // --- Reveal-in-place ("Show more") ---

  function revealMore(month: string, total: number) {
    setMonthVisible((prev) => {
      const current = prev[month] ?? SECTION_PAGE_SIZE
      return { ...prev, [month]: Math.min(current + SECTION_PAGE_SIZE, total) }
    })
  }

  function collapseMonth(month: string) {
    setMonthVisible((prev) => ({ ...prev, [month]: SECTION_PAGE_SIZE }))
  }

  const selectionMode: 'active' | 'again' | 'archived' =
    tab === 'new' || tab === 'previous' ? 'active' : tab === 'targeted' ? 'again' : 'archived'
  const colCount = 6
  const sendBusy = sendFlow.sendState !== 'idle'

  return (
    <div className="space-y-4">
      {/* Tabs — order: New leads, Send again, Previous leads, Archived (8.2) */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {([
          ['new', `New leads (${newLeads.length})`],
          ['targeted', `Send again (${targetedLeads.length})`],
          ['previous', `Previous leads (${previousLeads.length})`],
          ['archived', `Archived${archivedLoaded ? ` (${dedupedArchived.length})` : ''}`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Controls — new / previous tabs (un-dispatched leads) */}
      {(tab === 'new' || tab === 'previous') && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Adding an address only makes sense on New leads (4.6). The empty
              span keeps the right-hand buttons on the right on Previous. */}
          {tab === 'new' ? (
            <Button size="sm" variant="outline" onClick={() => setShowAddAddress(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Address
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {tab === 'new' && (
              <Button asChild size="sm" variant="outline">
                <Link href="/settings#lead-preferences">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                  Change price, type or distance
                </Link>
              </Button>
            )}
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
              onClick={() => sendFlow.beginSend(selected.map((l) => l.id))}
              disabled={sendBusy || selected.length === 0}
            >
              <SendHorizonal className="h-4 w-4 mr-1.5" />
              {`Send ${selected.length > 0 ? selected.length : ''} Postcard${selected.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {/* Controls — Send again tab (8.1) */}
      {tab === 'targeted' && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm text-slate-600">
            {againSelected.size} selected of {targetedLeads.length} previously sent
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            {targetedLeads.length > 0 && (
              <Button size="sm" variant="outline" onClick={selectAllAgain}>
                {againSelected.size === targetedLeads.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
            {targetedLeads.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => archiveLeads(targetedLeads.map((l) => l.id))}
                disabled={archiving}
              >
                <Archive className="h-3.5 w-3.5 mr-1" />
                {archiving ? 'Archiving…' : 'Archive All'}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => sendFlow.beginSend([...againSelected], true)}
              disabled={sendBusy || againSelected.size === 0}
            >
              <RotateCw className="h-4 w-4 mr-1.5" />
              {`Send Again ${againSelected.size > 0 ? `(${againSelected.size})` : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Controls — Archived tab: tick leads and bring them back (4.4) */}
      {tab === 'archived' && dedupedArchived.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm text-slate-600">
            {archivedSelected.size} selected of {dedupedArchived.length} archived
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={selectAllArchived}>
              {archivedSelected.size === dedupedArchived.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              size="sm"
              onClick={() => unarchiveLeads([...archivedSelected])}
              disabled={unarchiving || archivedSelected.size === 0}
            >
              <ArchiveRestore className="h-4 w-4 mr-1.5" />
              {unarchiving
                ? 'Unarchiving…'
                : `Unarchive${archivedSelected.size > 0 ? ` (${archivedSelected.size})` : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
        {/* Fixed layout: every column is sized for the longest thing it can
            hold (an 8-figure price, "Flat/Maisonette", the sort arrow), so
            sorting never changes a column's width (4.2). */}
        <table className="w-full min-w-[760px] table-fixed text-sm">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-[8.5rem]" />
            <col className="w-40" />
            <col className="w-[7.5rem]" />
            <col className="w-32" />
          </colgroup>
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left"></th>
              {/* Clickable, sortable column headers (8.3) */}
              <th className="px-4 py-3 text-left font-medium text-slate-600">Address</th>
              <SortableHeader label="Price" field="price" align="right" state={priceSort} onSort={cycleSort} />
              <SortableHeader label="Type" field="type" align="center" state={typeSort} onSort={cycleSort} />
              <SortableHeader label="Distance" field="distance" align="right" state={distanceSort} onSort={cycleSort} />
              <SortableHeader
                label="Date"
                field="date"
                align="left"
                state={dateSort}
                onSort={cycleSort}
                hint="The date the sale completed"
              />
            </tr>
          </thead>
          <tbody className="divide-y">
            {monthGroups.map(({ month, leads: monthLeads }) => {
              const visible = monthVisible[month] ?? SECTION_PAGE_SIZE
              const visibleLeads = monthLeads.slice(0, visible)
              const hasMore = monthLeads.length > visible
              const isExpanded = visible > SECTION_PAGE_SIZE

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
                      blurred={!isSubscribed && index >= 5}
                      checked={
                        selectionMode === 'active'
                          ? lead.selected_for_dispatch
                          : selectionMode === 'again'
                          ? againSelected.has(lead.id)
                          : archivedSelected.has(lead.id)
                      }
                      onToggle={
                        selectionMode === 'active'
                          ? toggleLead
                          : selectionMode === 'again'
                          ? toggleAgain
                          : toggleArchived
                      }
                    />
                  ))}

                  {/* Show more (reveal-in-place) / Collapse (8.5) */}
                  {(hasMore || isExpanded) && (
                    <tr>
                      <td colSpan={colCount} className="px-4 py-2 text-center">
                        {hasMore ? (
                          <button
                            onClick={() => revealMore(month, monthLeads.length)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                            Show more ({monthLeads.length - visible} remaining)
                          </button>
                        ) : (
                          <button
                            onClick={() => collapseMonth(month)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                            Collapse
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </MonthSection>
              )
            })}
          </tbody>
        </table>
        </div>

        {/* Subscription overlay */}
        {!isSubscribed && currentLeads.length > 5 && (
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white via-white/90 to-transparent flex items-end justify-center pb-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <Lock className="h-5 w-5 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Subscribe to view all leads</p>
              <Link
                href="/billing"
                className="inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
              >
                View plans
              </Link>
            </div>
          </div>
        )}

        {currentLeads.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            {tab === 'new' && 'No new leads this month yet.'}
            {tab === 'previous' && 'No previous leads.'}
            {tab === 'targeted' && 'No postcards sent yet.'}
            {tab === 'archived' && 'No archived leads.'}
          </div>
        )}
      </div>

      <AddAddressModal
        open={showAddAddress}
        onClose={() => setShowAddAddress(false)}
        onAdded={() => {
          setShowAddAddress(false)
          window.location.reload()
        }}
      />

      {sendFlow.dialogs}
    </div>
  )
}

/** Wrapper fragment for month sections — just passes children through */
function MonthSection({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/**
 * A sortable column header. The label reserves its bold width up front, so
 * the arrow never shifts when a column becomes the active sort.
 *
 * `hint` adds a short explanation (4.3): shown on hover where the device can
 * hover, and behind a small ⓘ button that toggles it on touch screens.
 */
function SortableHeader({
  label,
  field,
  align,
  state,
  onSort,
  hint,
}: {
  label: string
  field: SortField
  align: 'left' | 'right' | 'center'
  state: SortState
  onSort: (field: SortField) => void
  hint?: string
}) {
  const [hintOpen, setHintOpen] = useState(false)
  const cellRef = useRef<HTMLTableCellElement>(null)

  // Tap anywhere else to close the tapped-open hint.
  useEffect(() => {
    if (!hintOpen) return
    const close = (e: PointerEvent) => {
      if (!cellRef.current?.contains(e.target as Node)) setHintOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [hintOpen])

  const active = state !== 0
  let Icon = ArrowUpDown
  if (state === 1) Icon = ArrowDown
  if (state === 2) Icon = ArrowUp

  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const hintId = hint ? `hint-${field}` : undefined

  return (
    <th ref={cellRef} className={`group/hint relative px-4 py-3 font-medium ${textAlign}`}>
      <div className={`flex items-center gap-1 ${justify}`}>
        <button
          type="button"
          onClick={() => onSort(field)}
          title={hint ? undefined : `Sort by ${label.toLowerCase()}`}
          aria-describedby={hintId}
          className={`group inline-flex items-center gap-1 cursor-pointer select-none transition-colors ${
            active ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="grid">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
              {label}
            </span>
            <span className={`col-start-1 row-start-1 ${active ? 'font-semibold' : 'group-hover:font-semibold'}`}>
              {label}
            </span>
          </span>
          <Icon
            className={`h-3 w-3 shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
          />
        </button>
        {hint && (
          // Touch screens only: there's no hover to reveal the hint there.
          <button
            type="button"
            onClick={() => setHintOpen((o) => !o)}
            aria-label={`What does ${label} mean?`}
            aria-expanded={hintOpen}
            className="-m-1.5 hidden items-center justify-center p-1.5 text-slate-400 hover:text-slate-600 [@media(hover:none)]:inline-flex"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {hint && (
        <span
          id={hintId}
          role="tooltip"
          className={`pointer-events-none absolute right-2 top-full z-20 -mt-1 w-max max-w-[14rem] rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-white shadow-lg ${
            hintOpen ? 'block' : 'hidden group-hover/hint:block'
          }`}
        >
          {hint}
        </span>
      )}
    </th>
  )
}

function LeadRow({
  lead,
  blurred,
  checked,
  onToggle,
}: {
  lead: Lead
  blurred: boolean
  checked: boolean
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <tr
      className={`hover:bg-slate-50 transition-colors ${blurred ? 'blur-sm pointer-events-none select-none' : ''}`}
    >
      <td className="px-4 py-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onToggle(lead.id, !!value)}
        />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800 break-words">
          {formatAddressLine(lead.address_line)}
          {/* Why this lead is here: the user brought it back from Archived (4.4). */}
          {lead.unarchived_at && (
            <span className="ml-2 inline-block whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 align-middle text-[11px] font-normal text-slate-400">
              Unarchived {formatDayMonth(lead.unarchived_at)}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-400">{formatPostcode(lead.postcode)}</p>
      </td>
      <td className="px-4 py-3 text-right font-semibold text-slate-800">
        {lead.price != null ? formatPricePence(lead.price) : '–'}
      </td>
      <td className="px-4 py-3 text-center">
        {lead.property_type ? (
          <Badge variant="secondary" className="text-xs">
            {PROPERTY_TYPE_LABELS[lead.property_type as keyof typeof PROPERTY_TYPE_LABELS] ?? lead.property_type}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-500">Custom</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right text-slate-600">
        {lead.distance_miles != null ? `${lead.distance_miles.toFixed(1)} mi` : '–'}
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs">
        {lead.date_of_transfer ? formatDate(lead.date_of_transfer) : '–'}
      </td>
    </tr>
  )
}
