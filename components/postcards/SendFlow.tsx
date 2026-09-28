'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Loader2, SendHorizonal, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmEmptyBackDialog } from '@/components/leads/ConfirmEmptyBackDialog'

// Cost preview returned by POST /api/postcards { action: 'preview' }.
export type PreviewData = {
  preview: true
  requested?: number
  quantity: number
  suppressed?: number
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
export type OrderResult = {
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
export type SendState = 'idle' | 'previewing' | 'confirm' | 'confirming' | 'held' | 'cancelling'

/** A held order, as passed to onHeld / onCancelled. */
export type SendOrder = { orderId: string; leadIds: string[]; reactivate: boolean }

/**
 * The line at the top of the review step (fix list 4.7), e.g.
 * "2 cards: both included in your plan" or "7 cards: 5 included and 2 × £1.50 = £3.00".
 */
export function orderBreakdown(p: Pick<PreviewData, 'quantity' | 'includedApplied' | 'payable' | 'unitPricePence' | 'costFormatted'>): string {
  const cards = `${p.quantity} card${p.quantity === 1 ? '' : 's'}`
  if (p.payable === 0) {
    if (p.quantity === 1) return '1 card: included in your plan'
    if (p.quantity === 2) return '2 cards: both included in your plan'
    return `${cards}: all included in your plan`
  }
  const paid = `${p.payable} × £${(p.unitPricePence / 100).toFixed(2)} = ${p.costFormatted}`
  return p.includedApplied > 0
    ? `${cards}: ${p.includedApplied} included and ${paid}`
    : `${cards}: ${paid}`
}

/**
 * Review order → confirm → 15-minute hold → cancel (feature 8.6), shared by
 * Leads and Tracking so "Send again" goes through the same steps wherever it
 * starts. Nothing is charged or sent until the user confirms; after that the
 * order is held and can be cancelled inside the cool-off window.
 *
 * `onHeld` / `onCancelled` let the caller update its own list (Leads moves
 * rows optimistically; Tracking just refreshes).
 */
export function useSendFlow({
  hasBackDesign,
  onHeld,
  onCancelled,
}: {
  /** False when no back design is set, so we warn before a blank back goes out. */
  hasBackDesign: boolean
  onHeld?: (order: SendOrder) => void
  onCancelled?: (order: SendOrder) => void
}) {
  const router = useRouter()
  const [sendState, setSendState] = useState<SendState>('idle')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [pendingLeadIds, setPendingLeadIds] = useState<string[]>([])
  const [order, setOrder] = useState<OrderResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [cancelInfo, setCancelInfo] = useState<string | null>(null)
  // Whether the pending send re-targets already-sent leads ("Send again").
  const [pendingReactivate, setPendingReactivate] = useState(false)
  // Held send args while the "no back design" warning is up (null = not shown).
  const [emptyBackPrompt, setEmptyBackPrompt] = useState<{ leadIds: string[]; reactivate: boolean } | null>(null)

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
  // (reactivate=true) the server treats already-sent leads as eligible and
  // re-claims them from their old job only when the order is confirmed.
  // Nothing is detached up front, so closing this modal changes nothing.
  async function beginSend(leadIds: string[], reactivate = false, bypassEmptyBackWarning = false) {
    if (leadIds.length === 0) {
      toast.error('No leads selected')
      return
    }
    // No back design set, so the back prints blank. Warn once, then let the
    // user add a back or send anyway. Nothing about the order changes here.
    if (!hasBackDesign && !bypassEmptyBackWarning) {
      setEmptyBackPrompt({ leadIds, reactivate })
      return
    }
    setSendError(null)
    setCancelInfo(null)
    setOrder(null)
    setPendingReactivate(reactivate)
    setSendState('previewing')
    setPendingLeadIds(leadIds)

    try {
      const res = await fetch('/api/postcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', leadIds, resend: reactivate }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not prepare your order')
        resetSend()
        return
      }
      if (reactivate && data.quantity === 0) {
        toast.error(
          leadIds.length === 1
            ? 'That postcard is still on its way, so it can’t be sent again yet.'
            : 'Those postcards are still on their way, so they can’t be sent again yet.'
        )
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
  // The previewed cost and card count go with the request; if either has
  // changed by the time the server gets there, nothing is charged and we show
  // the fresh figures for the user to confirm again.
  async function confirmSend() {
    if (pendingLeadIds.length === 0 || !preview) return
    setSendError(null)
    setSendState('confirming')
    try {
      const res = await fetch('/api/postcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: pendingLeadIds,
          resend: pendingReactivate,
          expectedCostPence: preview.costPence,
          expectedQuantity: preview.quantity,
        }),
      })
      const data = await res.json()
      if (res.status === 409 && data.costChanged && data.preview) {
        setPreview(data.preview as PreviewData)
        setSendError(data.error ?? 'Your order has changed. Please check the new figures and confirm again.')
        setSendState('confirm')
        return
      }
      if (res.status === 201 && data.success) {
        setOrder(data as OrderResult)
        setSendState('held')
        onHeld?.({ orderId: data.orderId, leadIds: pendingLeadIds, reactivate: pendingReactivate })
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
        onCancelled?.({ orderId: order.orderId, leadIds: pendingLeadIds, reactivate: pendingReactivate })
        const refund = data.refundFormatted ?? '£0.00'
        const n = data.cancelled as number
        setCancelInfo(
          `Order cancelled. ${n} postcard${n === 1 ? '' : 's'} held back` +
            (data.refundedPence > 0 ? ` and ${refund} refunded.` : '.')
        )
        toast.success('Order cancelled')
      } else {
        setCancelInfo(data.error ?? 'This order can no longer be cancelled.')
      }
    } catch {
      setCancelInfo('Could not cancel the order. Please try again.')
    }
    setSendState('held')
  }

  const dialogs = (
    <>
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
      <ConfirmEmptyBackDialog
        open={emptyBackPrompt !== null}
        count={emptyBackPrompt?.leadIds.length ?? 0}
        onSendAnyway={() => {
          const pending = emptyBackPrompt
          setEmptyBackPrompt(null)
          if (pending) beginSend(pending.leadIds, pending.reactivate, true)
        }}
        onAddBack={() => {
          setEmptyBackPrompt(null)
          router.push('/postcards/design')
        }}
        onCancel={() => setEmptyBackPrompt(null)}
      />
    </>
  )

  return { sendState, beginSend, dialogs }
}

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
              <p className="text-slate-700">{orderBreakdown(preview)}</p>

              {preview.alreadySent > 0 && (
                <p className="text-xs text-slate-500">
                  {preview.alreadySent} of your selected lead{preview.alreadySent === 1 ? ' was' : 's were'} already
                  sent and skipped.
                </p>
              )}

              {(preview.suppressed ?? 0) > 0 && (
                <p className="text-xs text-slate-500">
                  {preview.suppressed} {preview.suppressed === 1 ? 'address is' : 'addresses are'} on the
                  do-not-contact list and {preview.suppressed === 1 ? 'was' : 'were'} removed.
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
                  You need a postcard design before sending. Open Postcard Design to create or upload one.
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
                    <Clock size={18} className="mt-0.5 text-brand shrink-0" />
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
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={onConfirm} disabled={!canConfirm || busy}>
                {state === 'confirming' ? <Loader2 size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
                {preview && preview.payable > 0 ? `Confirm & pay ${preview.costFormatted}` : 'Confirm & send'}
              </Button>
            </>
          )}

          {(state === 'held' || state === 'cancelling') && (
            <>
              {!cancelInfo && (
                <Button variant="outline" onClick={onCancelOrder} disabled={state === 'cancelling'}>
                  {state === 'cancelling' ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  Cancel order
                </Button>
              )}
              <Button onClick={onClose}>Done</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
