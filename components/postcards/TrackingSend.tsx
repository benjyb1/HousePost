'use client'

import { createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCw } from 'lucide-react'
import { useSendFlow } from './SendFlow'

type TrackingSend = { beginSend: (leadIds: string[], reactivate?: boolean) => void; busy: boolean }

const TrackingSendContext = createContext<TrackingSend | null>(null)

/**
 * One send flow for the whole Tracking page, so every row's "Send again" goes
 * through the same review order, cost preview and 15-minute cool-off as a send
 * from Leads (fix list 5.5). The page refreshes when an order is held or
 * cancelled, so the new card shows up in the list.
 */
export function TrackingSendProvider({
  hasBackDesign,
  children,
}: {
  hasBackDesign: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const flow = useSendFlow({
    hasBackDesign,
    onHeld: () => router.refresh(),
    onCancelled: () => router.refresh(),
  })
  return (
    <TrackingSendContext.Provider value={{ beginSend: flow.beginSend, busy: flow.sendState !== 'idle' }}>
      {children}
      {flow.dialogs}
    </TrackingSendContext.Provider>
  )
}

/**
 * "Send again" for one Tracking row. Unavailable while the card is still on
 * its way to print (sending again then would print a second card), or when
 * the lead it came from no longer exists.
 */
export function SendAgainButton({ leadId, inFlight }: { leadId: string | null; inFlight: boolean }) {
  const ctx = useContext(TrackingSendContext)
  const unavailable = !leadId
    ? 'This lead is no longer in your account'
    : inFlight
      ? 'You can send again once this card has gone to print'
      : null

  return (
    <button
      type="button"
      onClick={() => leadId && ctx?.beginSend([leadId], true)}
      disabled={!!unavailable || !ctx || ctx.busy}
      title={unavailable ?? 'Send another postcard to this address'}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RotateCw size={12} />
      Send again
    </button>
  )
}
