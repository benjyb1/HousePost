'use client'

import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { EXCEPTIONS, JOURNEY, statusColour, statusLabel, type StatusGuideEntry } from './status'

function Entry({ entry }: { entry: StatusGuideEntry }) {
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColour(entry.key)}`}
      >
        {statusLabel(entry.key)}
      </span>
      <p className="text-sm leading-snug text-slate-600">{entry.meaning}</p>
      {entry.reasons && (
        <ul className="ml-4 list-disc space-y-1 text-sm leading-snug text-slate-600">
          {entry.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * "What do these mean?" (fix list 5.2): every status exactly as it appears in
 * the Tracking table, with its coloured label and a plain-English line. Opens
 * as a panel from the right, or from the bottom on phones.
 */
export function StatusGuide() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="self-start">
          <HelpCircle className="h-4 w-4" />
          What do these mean?
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>What the statuses mean</SheetTitle>
          <SheetDescription>Where each postcard is, in the words the table uses.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <h3 className="pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">On its way</h3>
          <ol className="divide-y">
            {JOURNEY.map((e) => (
              <Entry key={e.key} entry={e} />
            ))}
          </ol>
          <h3 className="pt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            If something goes wrong
          </h3>
          <ul className="divide-y">
            {EXCEPTIONS.map((e) => (
              <Entry key={e.key} entry={e} />
            ))}
          </ul>
          <p className="pt-4 text-xs text-slate-400">
            More in the{' '}
            <Link href="/help#statuses" className="underline hover:text-slate-600">
              help page
            </Link>
            .
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
