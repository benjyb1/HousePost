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
import { EXCEPTIONS, JOURNEY, statusLabel, type StatusGuideEntry } from './status'

function Entry({ entry }: { entry: StatusGuideEntry }) {
  return (
    <li className="flex flex-col gap-1 py-3">
      <span className="text-[15px] font-semibold text-ink">{statusLabel(entry.key)}</span>
      <p className="text-[14.5px] leading-normal text-ink-2">{entry.meaning}</p>
      {entry.reasons && (
        <ul className="ml-4 list-disc space-y-1 text-[14.5px] leading-normal text-ink-2 marker:text-line-2">
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
        <Button variant="ghost" size="sm" className="self-start">
          <HelpCircle className="h-4 w-4" />
          What do these mean?
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>What the statuses mean</SheetTitle>
          <SheetDescription>Where each postcard is, in the words the list uses.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <h3 className="pt-5 text-[13.5px] font-semibold text-ink-2">On its way</h3>
          <ol className="divide-y divide-line">
            {JOURNEY.map((e) => (
              <Entry key={e.key} entry={e} />
            ))}
          </ol>
          <h3 className="border-t border-line pt-5 text-[13.5px] font-semibold text-ink-2">If something goes wrong</h3>
          <ul className="divide-y divide-line">
            {EXCEPTIONS.map((e) => (
              <Entry key={e.key} entry={e} />
            ))}
          </ul>
          <p className="border-t border-line pt-4 text-[14px] text-ink-2">
            More in the{' '}
            <Link href="/help#statuses" className="font-semibold text-navy-ink underline underline-offset-4">
              help page
            </Link>
            .
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
