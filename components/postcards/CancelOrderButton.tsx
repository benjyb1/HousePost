'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Lets a user cancel a still-held order straight from the Tracking table — the
// escape hatch for someone who closed the send modal before the cool-off ended.
// Posts the batch id to the cancel endpoint, which only cancels rows that are
// still 'held' (the cron flips to 'dispatching' before sending), so this is
// race-safe against dispatch.
export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const [cancelling, setCancelling] = useState(false)
  const router = useRouter()

  async function handleCancel() {
    setCancelling(true)
    try {
      const res = await fetch('/api/postcards/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not cancel this order')
      } else {
        toast.success('Order cancelled')
        router.refresh()
      }
    } catch {
      toast.error('Could not cancel this order')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      title="Cancel this order before it is sent"
    >
      {cancelling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
      Cancel order
    </button>
  )
}
