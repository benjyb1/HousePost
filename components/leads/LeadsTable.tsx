'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPricePence, formatDate, formatMonthKey } from '@/lib/utils/date'
import { formatAddressLine, formatPostcode } from '@/lib/address/format'
import { addressKey } from '@/lib/address/normalise'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'
import { INCLUDED_POSTCARDS_PER_MONTH } from '@/types/profile'
import type { SubscriptionStatus } from '@/types/profile'
import {
  ArrowUpDown, ArrowUp, ArrowDown, SendHorizonal,
  Archive, Lock, ChevronDown, ChevronUp, Plus, Loader2, X,
  Clock, RotateCw,
} from 'lucide-react'
import AddAddressModal from './AddAddressModal'
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
  is_custom: boolean
  created_at?: string | null
}

type SortField = 'distance' | 'price' | 'type' | 'date'
type SortState = 0 | 1 | 2
type Tab = 'new' | 'previous' | 'targeted' | 'archived'

// Cost preview returned by POST /api/postcards { action: 'preview' }.
type PreviewData = {
  preview: true
  requested?: number
  quantity: number
  alreadySent: number
  used: number
  includedRemaining: number
  includedApplied: number
  payable: number
  unitPricePence: number
  costPence: number
  costFormatted: string
  cap: number
  capRemaining: number
  wouldExceedCap: boolean
  designsReady: boolean
}

// Confirmed-order response (201) from POST /api/postcards.
type OrderResult = {
  success: true
  orderId: string
  quantity: number
  included: number
  payable: number
  costFormatted: string
  paymentIntentId: string | null
  releaseAt: string
  coolOffMinutes: number
}

// The send modal walks through these states.
type SendState = 'idle' | 'previewing' | 'confirm' | 'confirming' | 'held' | 'cancelling'

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
  const [archiving, setArchiving] = useState(false)
  const [tab, setTab] = useState<Tab>('new')
  // Per-month count of currently revealed rows — "Show more" bumps this in
  // place (see revealMore) rather than jumping to a fully-expanded list.
  const [monthVisible, setMonthVisible] = useState<Record<string, number>>({})
  const [showAddAddress, setShowAddAddress] = useState(false)
  // Local selection for the "Send again" tab (targeted leads carry no
  // selected_for_dispatch flag of their own once sent).
  const [againSelected, setAgainSelected] = useState<Set<string>>(new Set())

  // --- Send / cost-preview / cool-off flow state ---
  const [sendState, setSendState] = useState<SendState>('idle')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [pendingLeadIds, setPendingLeadIds] = useState<string[]>([])
  const [order, setOrder] = useState<OrderResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [cancelInfo, setCancelInfo] = useState<string | null>(null)
  // Whether the pending send re-targets already-sent leads ("Send again").
  const [pendingReactivate, setPendingReactivate] = useState(false)

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  // Collapse duplicate addresses to a single record. "1 TOLPUDDLE ST" and
  // "1 TOLPUDDLE STREET" (same postcode) share an addressKey, so they would
  // otherwise show — and be billable — twice. We keep one row per key, preferring
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

  // "New leads" = your most recent batch. Leads drop on the 22nd, so the newest
  // batch must stay "new" until the next drop — keying off the calendar month
  // would show 0 new leads for the ~3 weeks before each drop. "Previous leads" =
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

  // Click a column header to cycle its sort: off → descending → ascending → off.
  // Read the clicked field's current state first, then set all four in one go
  // (resetting then incrementing in separate calls always landed back on 1).
  function cycleSort(field: SortField) {
    const stateMap: Record<SortField, SortState> = {
      distance: distanceSort,
      price: priceSort,
      type: typeSort,
      date: dateSort,
    }
    const next = (((stateMap[field] + 1) % 3) as SortState)
    setDistanceSort(field === 'distance' ? next : 0)
    setPriceSort(field === 'price' ? next : 0)
    setTypeSort(field === 'type' ? next : 0)
    setDateSort(field === 'date' ? next : 0)
  }

  async function switchTab(t: Tab) {
    setTab(t)
    setMonthVisible({})
    setAgainSelected(new Set())

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
      toast.error('Could not update that selection — please try again.')
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
    const toSelect = isSubscribed
      ? activeLeads.filter((l) => !l.selected_for_dispatch)
      : activeLeads.filter((l) => !l.selected_for_dispatch).slice(0, 5 - selected.length)

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
      toast.error('Some leads could not be selected — please try again.')
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
      toast.error('Some leads could not be deselected — please try again.')
    }
  }

  // --- "Send again" selection ---

  function toggleAgain(id: string, checked: boolean) {
    setAgainSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function selectAllAgain() {
    if (againSelected.size === targetedLeads.length) {
      setAgainSelected(new Set())
    } else {
      setAgainSelected(new Set(targetedLeads.map((l) => l.id)))
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

  // --- Send flow: preview → confirm → cool-off/cancel (feature 8.6) ---

  function resetSend() {
    setSendState('idle')
    setPreview(null)
    setPendingLeadIds([])
    setOrder(null)
    setSendError(null)
    setCancelInfo(null)
    setPendingReactivate(false)
  }

  // Fetch the cost preview and open the confirmation modal. For "Send again"
  // (reactivate=true) we first detach the selected already-sent leads from their
  // old jobs so the normal send flow treats them as sendable again.
  async function beginSend(leadIds: string[], reactivate = false) {
    if (leadIds.length === 0) {
      toast.error('No leads selected')
      return
    }
    setSendError(null)
    setCancelInfo(null)
    setOrder(null)
    setPendingReactivate(reactivate)
    setSendState('previewing')

    let ids = leadIds
    if (reactivate) {
      try {
        const res = await fetch('/api/leads/reactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: leadIds }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? 'Could not prepare those leads')
          resetSend()
          return
        }
        ids = (data.ids as string[]) ?? []
        if (ids.length === 0) {
          toast.error('Those leads are still being sent and cannot be re-sent yet.')
          resetSend()
          return
        }
      } catch {
        toast.error('Could not prepare those leads')
        resetSend()
        return
      }
    }

    setPendingLeadIds(ids)

    try {
      const res = await fetch('/api/postcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', leadIds: ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not prepare your order')
        resetSend()
        return
      }
      setPreview(data as PreviewData)
      setSendState('confirm')
    } catch {
      toast.error('Could not prepare your order')
      resetSend()
    }
  }

  // Confirm the order: charge the saved card and hold for the cool-off window.
  async function confirmSend() {
    if (pendingLeadIds.length === 0) return
    setSendError(null)
    setSendState('confirming')
    try {
      const res = await fetch('/api/postcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: pendingLeadIds }),
      })
      const data = await res.json()
      if (res.status === 201 && data.success) {
        setOrder(data as OrderResult)
        setSendState('held')
        // Optimistically move the held leads into "Send again" (they now carry a
        // job) and clear any selection state. Cancelling reverts this.
        setLeads((prev) =>
          prev.map((l) =>
            pendingLeadIds.includes(l.id)
              ? { ...l, postcard_job_id: data.orderId, selected_for_dispatch: false }
              : l
          )
        )
        setAgainSelected(new Set())
      } else {
        // 402 declined, 403 over cap, 409 no eligible leads, 400 designs missing.
        setSendError(data.error ?? 'Your order could not be placed.')
        setSendState('confirm')
      }
    } catch {
      setSendError('Your order could not be placed. Please try again.')
      setSendState('confirm')
    }
  }

  // Cancel a held order inside its cool-off window and refund any paid cards.
  async function cancelOrder() {
    if (!order) return
    setSendState('cancelling')
    try {
      const res = await fetch('/api/postcards/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.orderId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // Free the leads again (revert the optimistic hold).
        setLeads((prev) =>
          prev.map((l) =>
            pendingLeadIds.includes(l.id)
              ? { ...l, postcard_job_id: null, selected_for_dispatch: false }
              : l
          )
        )
        const refund = data.refundFormatted ?? '£0.00'
        setCancelInfo(
          `Order cancelled — ${data.cancelled} postcard${data.cancelled === 1 ? '' : 's'} held back` +
            (data.refundedPence > 0 ? `, ${refund} refunded.` : '.')
        )
        toast.success('Order cancelled')
      } else {
        setCancelInfo(data.error ?? 'This order can no longer be cancelled.')
        setSendState('held')
        return
      }
    } catch {
      setCancelInfo('Could not cancel the order. Please try again.')
      setSendState('held')
      return
    }
    setSendState('held')
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

  // --- Sub-components ---

  function SortableHeader({
    label,
    field,
    align,
  }: {
    label: string
    field: SortField
    align: 'left' | 'right' | 'center'
  }) {
    const stateMap = { distance: distanceSort, price: priceSort, type: typeSort, date: dateSort }
    const state = stateMap[field]
    const active = state !== 0

    let Icon = ArrowUpDown
    if (state === 1) Icon = ArrowDown
    if (state === 2) Icon = ArrowUp

    const justify =
      align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
    const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

    return (
      <th className={`px-4 py-3 font-medium ${textAlign}`}>
        <button
          type="button"
          onClick={() => cycleSort(field)}
          title={`Sort by ${label.toLowerCase()}`}
          className={`group inline-flex items-center gap-1 ${justify} cursor-pointer select-none transition-colours ${
            active ? 'font-semibold text-slate-900' : 'text-slate-600 hover:font-semibold hover:text-slate-900'
          }`}
        >
          {label}
          <Icon
            className={`h-3 w-3 transition-opacity ${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
          />
        </button>
      </th>
    )
  }

  function LeadRow({
    lead,
    index,
    showCheckbox,
    checked,
    onToggle,
  }: {
    lead: Lead
    index: number
    showCheckbox: boolean
    checked: boolean
    onToggle: (id: string, checked: boolean) => void
  }) {
    const isBlurred = !isSubscribed && index >= 5

    return (
      <tr
        className={`hover:bg-slate-50 transition-colours ${isBlurred ? 'blur-sm pointer-events-none select-none' : ''}`}
      >
        {showCheckbox && (
          <td className="px-4 py-3">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onToggle(lead.id, !!value)}
            />
          </td>
        )}
        <td className="px-4 py-3">
          <p className="font-medium text-slate-800">{formatAddressLine(lead.address_line)}</p>
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

  const selectionMode: 'active' | 'again' | 'none' =
    tab === 'new' || tab === 'previous' ? 'active' : tab === 'targeted' ? 'again' : 'none'
  const showCheckbox = selectionMode !== 'none'
  const colCount = showCheckbox ? 6 : 5

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
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colours ${
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
          {/* Add Address now occupies the freed top-left slot (8.4) */}
          <Button size="sm" variant="outline" onClick={() => setShowAddAddress(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Address
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
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
            {/* Send button — secondary lighter blue (8.7) */}
            <Button
              size="sm"
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={() => beginSend(selected.map((l) => l.id))}
              disabled={sendState !== 'idle' || selected.length === 0}
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
            {/* Send again — secondary lighter blue, same flow as the main send */}
            <Button
              size="sm"
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={() => beginSend([...againSelected], true)}
              disabled={sendState !== 'idle' || againSelected.size === 0}
            >
              <RotateCw className="h-4 w-4 mr-1.5" />
              {`Send Again ${againSelected.size > 0 ? `(${againSelected.size})` : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              {showCheckbox && <th className="px-4 py-3 text-left w-10"></th>}
              {/* Clickable, sortable column headers (8.3) */}
              <th className="px-4 py-3 text-left font-medium text-slate-600">Address</th>
              <SortableHeader label="Price" field="price" align="right" />
              <SortableHeader label="Type" field="type" align="center" />
              <SortableHeader label="Distance" field="distance" align="right" />
              <SortableHeader label="Date" field="date" align="left" />
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
                      index={index}
                      showCheckbox={showCheckbox}
                      checked={
                        selectionMode === 'active'
                          ? lead.selected_for_dispatch
                          : selectionMode === 'again'
                          ? againSelected.has(lead.id)
                          : false
                      }
                      onToggle={selectionMode === 'again' ? toggleAgain : toggleLead}
                    />
                  ))}

                  {/* Show more (reveal-in-place) / Collapse (8.5) */}
                  {(hasMore || isExpanded) && (
                    <tr>
                      <td colSpan={colCount} className="px-4 py-2 text-center">
                        {hasMore ? (
                          <button
                            onClick={() => revealMore(month, monthLeads.length)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colours"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                            Show more ({monthLeads.length - visible} remaining)
                          </button>
                        ) : (
                          <button
                            onClick={() => collapseMonth(month)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colours"
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
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colours"
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

      <SendModal
        state={sendState}
        preview={preview}
        order={order}
        error={sendError}
        cancelInfo={cancelInfo}
        reactivate={pendingReactivate}
        onConfirm={confirmSend}
        onCancelOrder={cancelOrder}
        onClose={resetSend}
      />
    </div>
  )
}

/** Wrapper fragment for month sections — just passes children through */
function MonthSection({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/**
 * Cost-preview → confirm → cool-off/cancel modal (feature 8.6). Nothing is
 * charged or dispatched until the user confirms; after a 201 the order is held
 * and can be cancelled within the cool-off window.
 */
function SendModal({
  state,
  preview,
  order,
  error,
  cancelInfo,
  reactivate,
  onConfirm,
  onCancelOrder,
  onClose,
}: {
  state: SendState
  preview: PreviewData | null
  order: OrderResult | null
  error: string | null
  cancelInfo: string | null
  reactivate: boolean
  onConfirm: () => void
  onCancelOrder: () => void
  onClose: () => void
}) {
  if (state === 'idle') return null

  const busy = state === 'previewing' || state === 'confirming' || state === 'cancelling'
  const canConfirm =
    !!preview && preview.quantity > 0 && preview.designsReady && !preview.wouldExceedCap

  const breakdown = preview
    ? preview.payable === 0
      ? `${preview.quantity} card${preview.quantity === 1 ? '' : 's'}: all included in your plan — no charge.`
      : `${preview.quantity} card${preview.quantity === 1 ? '' : 's'}: ${preview.includedApplied} included + ${preview.payable} × £${(preview.unitPricePence / 100).toFixed(2)} = ${preview.costFormatted}`
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">
            {state === 'held' ? 'Order placed' : reactivate ? 'Send again' : 'Confirm your order'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          {/* Preparing preview */}
          {state === 'previewing' && (
            <div className="flex items-center gap-2 text-slate-500 py-4 justify-center">
              <Loader2 size={18} className="animate-spin" />
              Preparing your order…
            </div>
          )}

          {/* Confirmation step */}
          {(state === 'confirm' || state === 'confirming') && preview && (
            <>
              <p className="text-slate-700">{breakdown}</p>

              {preview.alreadySent > 0 && (
                <p className="text-xs text-slate-500">
                  {preview.alreadySent} of your selected lead{preview.alreadySent === 1 ? ' was' : 's were'} already
                  sent and skipped.
                </p>
              )}

              <p className="text-xs text-slate-500">
                {preview.payable > 0
                  ? `£${(preview.costPence / 100).toFixed(2)} will be charged to your saved card now. `
                  : ''}
                Orders are held for a short cool-off window before posting, so you can still cancel.
              </p>

              {!preview.designsReady && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  You need to upload a front and back postcard design before sending. Open Postcard Design to add them.
                </p>
              )}

              {preview.wouldExceedCap && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  This would exceed your monthly limit of {preview.cap} postcards. You have {preview.capRemaining}{' '}
                  remaining this billing period.
                </p>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          )}

          {/* Held / cool-off step */}
          {(state === 'held' || state === 'cancelling') && order && (
            <>
              {!cancelInfo ? (
                <>
                  <div className="flex items-start gap-2 text-slate-700">
                    <Clock size={18} className="mt-0.5 text-blue-500 shrink-0" />
                    <p>
                      {order.quantity} postcard{order.quantity === 1 ? '' : 's'} held and will send in about{' '}
                      {order.coolOffMinutes} minutes. You can cancel until then for a full refund of any charge.
                    </p>
                  </div>
                  {order.payable > 0 && (
                    <p className="text-xs text-slate-500">{order.costFormatted} charged to your saved card.</p>
                  )}
                </>
              ) : (
                <p className="text-slate-700">{cancelInfo}</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-slate-50 rounded-b-xl">
          {(state === 'confirm' || state === 'confirming') && (
            <>
              <button
                onClick={onClose}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={!canConfirm || busy}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {state === 'confirming' ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
                {preview && preview.payable > 0 ? `Confirm & pay ${preview.costFormatted}` : 'Confirm & send'}
              </button>
            </>
          )}

          {(state === 'held' || state === 'cancelling') && (
            <>
              {!cancelInfo && (
                <button
                  onClick={onCancelOrder}
                  disabled={state === 'cancelling'}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {state === 'cancelling' ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  Cancel order
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
