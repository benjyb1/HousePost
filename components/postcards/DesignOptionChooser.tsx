'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LayoutTemplate, Upload, Sparkles, ChevronRight } from 'lucide-react'

export type DesignOption = 'template' | 'upload' | 'request'

const OPTIONS: {
  id: DesignOption
  title: string
  blurb: string
  icon: typeof Upload
  badge?: string
}[] = [
  {
    id: 'template',
    title: 'Use a template',
    blurb: 'Start from a ready-made design and personalise it in the browser — no downloads.',
    icon: LayoutTemplate,
  },
  {
    id: 'upload',
    title: 'Upload custom design',
    blurb: 'Already have artwork? Upload your front and back as print-ready PDFs.',
    icon: Upload,
  },
  {
    id: 'request',
    title: 'Request custom design',
    blurb: 'We design a professional postcard for you from your brand and brief.',
    icon: Sparkles,
    badge: '£75',
  },
]

/**
 * The first screen of the Postcard design section: three ways to get artwork
 * onto a card. Selecting one reveals that flow (handled by the parent page).
 */
export function DesignOptionChooser({
  onSelect,
}: {
  onSelect: (option: DesignOption) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {OPTIONS.map(({ id, title, blurb, icon: Icon, badge }) => (
        <Card
          key={id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect(id)
            }
          }}
          className="group cursor-pointer transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </span>
              {badge && (
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {badge}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{blurb}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:text-slate-900">
              Choose <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
