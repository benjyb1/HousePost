'use client'

import { createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
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
      className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[3px] bg-transparent px-1 text-[13.5px] font-semibold text-navy-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy disabled:cursor-not-allowed disabled:text-ink-2 disabled:no-underline disabled:opacity-60"
    >
      Send again
    </button>
  )
}
