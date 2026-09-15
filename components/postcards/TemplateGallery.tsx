'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, ImageIcon, Upload } from 'lucide-react'
import { POSTCARD_TEMPLATES, templateIsPlaceholder } from './templates'

/**
 * Gallery of ready-made postcard templates. Each card links to its OWN Canva
 * template URL — opening it copies that design into the customer's own Canva
 * account to edit, which sidesteps the fact that a Canva folder can't be shared
 * by a single link (and a raw folder link hits a login wall).
 *
 * We do NOT ship an in-browser editor: guaranteeing print quality (vector text
 * over a high-resolution background at the A6 300 DPI spec) can't be promised
 * from a rasterising canvas editor, so we lean on Canva, which does guarantee it.
 */
export function TemplateGallery({ onUseUpload }: { onUseUpload?: () => void }) {
  return (
    <div className="space-y-6">
      <HowItWorks onUseUpload={onUseUpload} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {POSTCARD_TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  )
}

function HowItWorks({ onUseUpload }: { onUseUpload?: () => void }) {
  const steps = [
    'Open a template in Canva — it copies into your own Canva account.',
    'Edit the text, colours and logo to make it yours.',
    'Download it as a print-ready PDF (PDF Print, A6, with crop marks & bleed).',
    'Come back and upload it under “Upload custom design”.',
  ]
  return (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="space-y-3 p-5">
        <h3 className="text-sm font-semibold text-slate-900">How templates work</h3>
        <ol className="space-y-1.5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {onUseUpload && (
          <Button variant="outline" size="sm" onClick={onUseUpload} className="mt-1">
            <Upload className="mr-2 h-4 w-4" />
            Go to upload
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function TemplateCard({ template }: { template: (typeof POSTCARD_TEMPLATES)[number] }) {
  const [imgError, setImgError] = useState(false)
  const placeholder = templateIsPlaceholder(template.canvaUrl)

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[148/105] w-full border-b border-slate-100 bg-slate-100">
        {template.previewImage && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.previewImage}
            alt={`${template.name} postcard template preview`}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            <ImageIcon className="h-7 w-7" />
            <span className="text-xs">Preview coming soon</span>
          </div>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{template.name}</h4>
          <p className="mt-0.5 text-xs text-slate-500">{template.description}</p>
        </div>
        {placeholder ? (
          <Button size="sm" variant="outline" disabled className="w-full">
            Link coming soon
          </Button>
        ) : (
          <Button asChild size="sm" className="w-full">
            <a href={template.canvaUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Canva
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
