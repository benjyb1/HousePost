'use client'

import { ChevronRight } from 'lucide-react'

export type DesignOption = 'template' | 'upload' | 'request'

const OPTIONS: {
  id: DesignOption
  title: string
  blurb: string
  price?: string
}[] = [
  {
    id: 'template',
    title: 'Use a template',
    blurb: 'Start from one of our designs and change the words, colour and logo in the browser.',
  },
  {
    id: 'upload',
    title: 'Upload custom design',
    blurb: 'Already have artwork? Upload your front and back as print-ready PDFs.',
  },
  {
    id: 'request',
    title: 'Request custom design',
    blurb: 'Send us your logo and a few notes and our designer makes the card for you.',
    price: '£75 one-off',
  },
]

/**
 * The first screen of Designs: three ways to get artwork onto a card, as three
 * plain Paper panels. Selecting one reveals that flow (handled by the parent).
 */
export function DesignOptionChooser({
  onSelect,
}: {
  onSelect: (option: DesignOption) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map(({ id, title, blurb, price }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="group flex flex-col items-start gap-2 rounded-lg border border-line bg-paper-hi p-5 text-left transition-colors hover:border-line-2 hover:bg-[#fbf9f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <span className="flex w-full items-baseline justify-between gap-3">
            <span className="text-[16px] font-semibold text-ink">{title}</span>
            {price && <span className="shrink-0 text-[13px] text-ink-2">{price}</span>}
          </span>
          <span className="flex-1 text-sm leading-relaxed text-ink-2">{blurb}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-navy-ink">
            Choose
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  )
}
