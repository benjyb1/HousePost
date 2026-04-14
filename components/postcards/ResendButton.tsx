'use client'

import { useState } from 'react'
import { RotateCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ResendButton({ jobId }: { jobId: string }) {
  const [sending, setSending] = useState(false)

  async function handleResend() {
    setSending(true)
    try {
      const res = await fetch('/api/postcards/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to re-send')
      } else {
        toast.success('Postcard re-sent!')
      }
    } catch {
      toast.error('Failed to re-send')
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      onClick={handleResend}
      disabled={sending}
      className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      title="Send another postcard to this address"
    >
      {sending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
      Send Again
    </button>
  )
}
