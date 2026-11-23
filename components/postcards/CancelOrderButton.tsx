'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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
      type="button"
      onClick={handleCancel}
      disabled={cancelling}
      aria-busy={cancelling}
      className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-transparent px-1 text-[13.5px] font-semibold text-navy-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy disabled:cursor-not-allowed disabled:text-ink-2 disabled:no-underline disabled:opacity-60"
      title="Cancel this order before it goes to print"
    >
      {cancelling && <Loader2 size={13} className="animate-spin" />}
      {cancelling ? 'Cancelling…' : 'Cancel order'}
    </button>
  )
}
