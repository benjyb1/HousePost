'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Top-up form for the prepaid print balance. Admin page only. */
export function TopUpForm() {
  const [pounds, setPounds] = useState('20')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const netPence = Math.round(Number(pounds) * 100)
    if (!Number.isFinite(netPence) || netPence <= 0) {
      toast.error('Enter an amount in pounds')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/ops/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ netPence }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Top-up failed')
      } else {
        toast.success(
          `Topped up £${(data.netPence / 100).toFixed(2)} (£${(data.grossPence / 100).toFixed(2)} charged incl. VAT)`
        )
        router.refresh()
      }
    } catch {
      toast.error('Top-up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div className="space-y-1">
        <label className="text-xs text-slate-500" htmlFor="topup-pounds">
          Amount (£, before VAT)
        </label>
        <Input
          id="topup-pounds"
          type="number"
          min={5}
          max={500}
          step={5}
          value={pounds}
          onChange={(e) => setPounds(e.target.value)}
          className="w-28"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        Top up
      </Button>
    </form>
  )
}

/** Bring every delayed card forward so the next cron run retries it. */
export function RetryNowButton({ count }: { count: number }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function retry() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/ops/retry', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error ?? 'Could not queue a retry')
      else {
        toast.success(`${data.brought_forward} card(s) will retry on the next run (within 5 minutes)`)
        router.refresh()
      }
    } catch {
      toast.error('Could not queue a retry')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={retry} disabled={busy || count === 0}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Retry now
    </Button>
  )
}
