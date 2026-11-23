'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AddAddressModal from '@/components/leads/AddAddressModal'
import { ConfirmEmptyBackDialog } from '@/components/leads/ConfirmEmptyBackDialog'
import { ConfirmLeaveDialog } from '@/components/postcards/ConfirmLeaveDialog'
import { StatusGuide } from '@/components/postcards/StatusGuide'
import CancelOrderButton from '@/components/postcards/CancelOrderButton'
import { SendAgainButton, TrackingSendProvider } from '@/components/postcards/TrackingSend'
import { useSendFlow, type PreviewData } from '@/components/postcards/SendFlow'
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner'
import { FailedPostcardsNotice } from '@/components/dashboard/FailedPostcardsNotice'

/*
  Dev only (see page.tsx). The send dialogs are the real useSendFlow with
  /api/postcards answered in the browser by example data, so nothing reaches
  the server. ?show=send-held and send-cancelled need "Confirm" (and then
  "Cancel order") clicked; the screenshot script does that.
*/

const SHOWS = [
  'add-address',
  'empty-back',
  'leave',
  'status-guide',
  'toasts',
  'send',
  'send-free',
  'send-cap',
  'send-design',
  'send-declined',
  'send-held',
  'send-cancelled',
]

const noop = () => {}

export function PopupsGallery({ show }: { show: string | null }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {show === 'add-address' && <AddAddressModal open onClose={noop} onAdded={noop} />}
      {show === 'empty-back' && (
        <ConfirmEmptyBackDialog open count={3} onSendAnyway={noop} onAddBack={noop} onCancel={noop} />
      )}
      {show === 'leave' && <ConfirmLeaveDialog open onConfirm={noop} onCancel={noop} />}
      {show === 'toasts' && <Toasts />}
      {show?.startsWith('send') && <SendDemo variant={show} />}

      <div className="mx-auto max-w-[880px] space-y-10 px-4 py-8 sm:px-8">
        <header className="space-y-2">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Popups</h1>
          <p className="text-[15px] text-ink-2">Example data. Open one dialog at a time:</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
            {SHOWS.map((s) => (
              <li key={s}>
                <Link href={`/dev/popups?show=${s}`} className="font-semibold text-navy-ink underline-offset-4 hover:underline">
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </header>

        <Section title="Subscription banner">
          <div className="-mx-4 space-y-3 sm:mx-0">
            <SubscriptionBanner status="past_due" />
            <SubscriptionBanner status="canceled" />
            <SubscriptionBanner status="incomplete" />
          </div>
        </Section>

        <Section title="Failed postcards notice">
          <FailedPostcardsNotice count={3} latestFailedAt="2099-01-01T00:00:00Z" />
        </Section>

        <Section title="Tracking actions">
          <TrackingSendProvider hasBackDesign>
            <div className="flex flex-wrap items-center gap-6">
              <CancelOrderButton orderId="demo" />
              <SendAgainButton leadId="demo" inFlight={false} />
              <SendAgainButton leadId="demo" inFlight />
              {show === 'status-guide' ? <OpenStatusGuide /> : <StatusGuide />}
            </div>
          </TrackingSendProvider>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Delete</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="sm" variant="outline">
              Small outline
            </Button>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Active</Badge>
            <Badge variant="secondary">Detached</Badge>
            <Badge variant="outline">Custom</Badge>
            <Badge variant="destructive">Failed</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </div>
        </Section>

        <Section title="Card, input, checkbox">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>A short description under the title.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="e.g. GU7 1BE" />
              <label className="flex items-center gap-2 text-[15px]">
                <Checkbox defaultChecked /> Email me when new homes come in
              </label>
              <label className="flex items-center gap-2 text-[15px]">
                <Checkbox /> Unticked
              </label>
            </CardContent>
          </Card>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** StatusGuide is uncontrolled, so open it the way a person would. */
function OpenStatusGuide() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    ref.current?.querySelector('button')?.click()
  }, [])
  return (
    <span ref={ref}>
      <StatusGuide />
    </span>
  )
}

function Toasts() {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    // After the root layout's Toaster has mounted, or the toasts are dropped.
    const t = setTimeout(() => {
      toast.success('Order cancelled', { duration: Infinity })
      toast.error('Could not cancel this order', { duration: Infinity })
      toast('This design was saved before in-browser editing, so it can’t be reopened to edit.', { duration: Infinity })
      toast.success('Account created. Taking you to billing…', { duration: Infinity })
    }, 300)
    return () => clearTimeout(t)
  }, [])
  return null
}

// ---------------------------------------------------------------------------
// Send flow with example answers from /api/postcards.

const PREVIEW: PreviewData = {
  preview: true,
  requested: 9,
  quantity: 7,
  suppressed: 1,
  alreadySent: 1,
  used: 0,
  includedRemaining: 5,
  includedApplied: 5,
  payable: 2,
  unitPricePence: 150,
  costPence: 300,
  costFormatted: '£3.00',
  cap: 50,
  capRemaining: 45,
  wouldExceedCap: false,
  designsReady: true,
}

function previewFor(variant: string): PreviewData {
  switch (variant) {
    case 'send-free':
      return { ...PREVIEW, requested: 2, quantity: 2, suppressed: 0, alreadySent: 0, includedApplied: 2, payable: 0, costPence: 0, costFormatted: '£0.00' }
    case 'send-cap':
      return { ...PREVIEW, capRemaining: 3, wouldExceedCap: true }
    case 'send-design':
      return { ...PREVIEW, designsReady: false }
    default:
      return PREVIEW
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function SendDemo({ variant }: { variant: string }) {
  const flow = useSendFlow({ hasBackDesign: true })
  const started = useRef(false)

  useEffect(() => {
    const original = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/api/postcards/cancel')) {
        return json({ success: true, cancelled: 7, refundedPence: 300, refundFormatted: '£3.00' })
      }
      if (url.includes('/api/postcards')) {
        const body = JSON.parse(String(init?.body ?? '{}'))
        if (body.action === 'preview') return json(previewFor(variant))
        if (variant === 'send-declined') {
          return json({ error: 'Your card was declined.' }, 402)
        }
        return json(
          {
            success: true,
            orderId: 'demo-order',
            quantity: 7,
            included: 5,
            payable: 2,
            costFormatted: '£3.00',
            paymentIntentId: 'pi_demo',
            releaseAt: '2099-01-01T00:15:00Z',
            coolOffMinutes: 15,
          },
          201,
        )
      }
      return original(input, init)
    }
    return () => {
      window.fetch = original
    }
  }, [variant])

  const { beginSend } = flow
  useEffect(() => {
    if (started.current) return
    started.current = true
    beginSend(['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'])
  }, [beginSend])

  return flow.dialogs
}
