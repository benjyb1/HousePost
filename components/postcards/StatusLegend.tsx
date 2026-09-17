import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

// The statuses a customer will actually see on Tracking, in the order a card
// moves through them, plus the two exceptions. Server component, pure CSS
// disclosure so it costs nothing on the page. Wording matches /help.
const STEPS: { label: string; meaning: string }[] = [
  { label: 'Scheduled', meaning: 'Queued behind the 15-minute cool-off. Cancel here for a full refund.' },
  { label: 'Sending', meaning: 'Being handed to print. Takes a moment.' },
  { label: 'Received', meaning: 'Accepted for printing.' },
  { label: 'Printing', meaning: 'On the press.' },
  { label: 'Printed', meaning: 'Printed, waiting to be posted.' },
  { label: 'Dispatched', meaning: 'Handed to Royal Mail. Usually arrives in 2 to 3 working days.' },
]

const EXCEPTIONS: { label: string; meaning: string; tone: string }[] = [
  {
    label: 'Delayed',
    tone: 'bg-amber-100 text-amber-800',
    meaning: 'A temporary problem on our side. Still queued, sent automatically once it clears, nothing extra to pay.',
  },
  {
    label: 'Failed',
    tone: 'bg-red-100 text-red-800',
    meaning: 'Not sent. Any charge is refunded and the lead returns to your list. The reason is shown under the status.',
  },
]

export function StatusLegend() {
  return (
    <details className="group w-full rounded-lg border bg-white text-sm sm:w-auto sm:max-w-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
        <span>What do the statuses mean?</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t px-3 py-3">
        <ol className="space-y-1.5">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex gap-2">
              <span className="mt-0.5 w-4 shrink-0 text-right text-xs text-slate-400">{i + 1}.</span>
              <span>
                <span className="font-medium text-slate-800">{s.label}</span>
                <span className="text-slate-500"> · {s.meaning}</span>
              </span>
            </li>
          ))}
        </ol>
        <ul className="space-y-1.5 border-t pt-3">
          {EXCEPTIONS.map((e) => (
            <li key={e.label} className="flex gap-2">
              <span className={`mt-0.5 inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${e.tone}`}>
                {e.label}
              </span>
              <span className="text-slate-500">{e.meaning}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400">
          More in the <Link href="/help" className="underline hover:text-slate-600">help page</Link>.
        </p>
      </div>
    </details>
  )
}
