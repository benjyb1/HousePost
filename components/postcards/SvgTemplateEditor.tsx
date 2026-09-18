'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowLeft, Check, RotateCcw, Upload, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PostcardPreview } from './PostcardPreview'
import {
  SVG_TEMPLATES,
  getTemplate,
  TEMPLATE_FIELDS,
  CARD_W,
  CARD_H,
  type TemplateValues,
} from './svg-templates'

/**
 * In-browser postcard template editor ("in-house Canva-lite").
 *
 * Templates are VECTOR SVG designed at the print spec (A6 landscape + 3mm bleed,
 * 1819×1311 @ 300 DPI). The live preview renders the very same SVG string that is
 * rasterised on save, so what you see is what prints. "Use this design" saves the
 * finished card as the user's FRONT design through the exact storage + profile
 * path the uploader uses.
 */

/** Rasterise a self-contained SVG string to a print-ready PNG at 1819×1311. */
function svgToPngBlob(svgString: string, w = CARD_W, h = CARD_H): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas not supported')
        // Solid white base so any transparency prints white, not black.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (out) => (out ? resolve(out) : reject(new Error('Failed to render image'))),
          'image/png'
        )
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to render image'))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to render template'))
    }
    img.src = url
  })
}

/** Renders an SVG string, scaled to fill its container while keeping A6 ratio. */
function SvgFrame({ svgString, className }: { svgString: string; className?: string }) {
  return (
    <div
      className={`overflow-hidden bg-white [&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${className ?? ''}`}
      style={{ aspectRatio: `${CARD_W}/${CARD_H}` }}
      // Safe: every dynamic value is XML-escaped in the template render fns.
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}

export function SvgTemplateEditor({
  onUseUpload,
  onAddBack,
  onBackToOptions,
}: {
  onUseUpload?: () => void
  /** Open the uploader on the BACK side (falls back to onUseUpload). */
  onAddBack?: () => void
  onBackToOptions?: () => void
}) {
  const addBack = onAddBack ?? onUseUpload
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [values, setValues] = useState<TemplateValues | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [savedBackUrl, setSavedBackUrl] = useState<string | null>(null)
  // When set, the front design has just been saved as active — show the
  // confirmation preview instead of silently returning to the editor.
  const [confirmFrontUrl, setConfirmFrontUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const res = await fetch('/api/settings', { cache: 'no-store' })
      const { profile } = await res.json()
      setSavedUrl(profile?.postcard_design_url ?? null)
      setSavedBackUrl(profile?.postcard_design_back_url ?? null)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const template = selectedId ? getTemplate(selectedId) : undefined

  function chooseTemplate(id: string) {
    const t = getTemplate(id)
    if (!t) return
    setSelectedId(id)
    setValues({ ...t.defaults })
  }

  function resetToDefaults() {
    if (template) setValues({ ...template.defaults })
  }

  const previewSvg = useMemo(
    () => (template && values ? template.render(values) : ''),
    [template, values]
  )
  const previewBackSvg = useMemo(
    () => (template && values ? template.renderBack(values) : ''),
    [template, values]
  )

  async function handleUse() {
    if (!template || !values || !userId) return
    setSaving(true)
    try {
      // Rasterise both sides to print-ready PNGs. The back is a full A6 card whose
      // design sits on the left half; its right half is white for the address.
      const [frontBlob, backBlob] = await Promise.all([
        svgToPngBlob(template.render(values)),
        svgToPngBlob(template.renderBack(values)),
      ])

      // Same storage keys the uploader uses for each side.
      const frontPath = `${userId}/design.png`
      const backPath = `${userId}/design-back.png`
      const store = supabase.storage.from('postcard-designs')

      const [frontUp, backUp] = await Promise.all([
        store.upload(frontPath, frontBlob, { upsert: true, contentType: 'image/png' }),
        store.upload(backPath, backBlob, { upsert: true, contentType: 'image/png' }),
      ])
      if (frontUp.error) throw frontUp.error
      if (backUp.error) throw backUp.error

      // Cache-bust exactly like the uploader — the storage keys are fixed, so a
      // fresh version query forces the new bytes everywhere the URLs are used.
      const stamp = Date.now()
      const frontUrl = `${store.getPublicUrl(frontPath).data.publicUrl}?v=${stamp}`
      const backUrl = `${store.getPublicUrl(backPath).data.publicUrl}?v=${stamp}`

      // One PATCH sets both active pointers the send pipeline reads.
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcard_design_url: frontUrl, postcard_design_back_url: backUrl }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to save')
      }

      setSavedUrl(frontUrl)
      setSavedBackUrl(backUrl)

      // Also record the front+back pair in the saved-designs LIBRARY.
      // Best-effort: a failure here must not undo the successful active save.
      try {
        await fetch('/api/postcards/designs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'template',
            front_url: frontUrl,
            back_url: backUrl,
            label: `${template.name} template · ${new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'short',
            }).format(new Date())}`,
          }),
        })
      } catch {
        /* non-fatal — the design is already saved as active */
      }

      toast.success('Front and back saved from your template')
      setConfirmFrontUrl(frontUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save design')
    } finally {
      setSaving(false)
    }
  }

  /* --------------------------- Confirmation step -------------------------- */
  if (confirmFrontUrl) {
    return (
      <div className="space-y-5">
        <Card className="border-green-200 bg-green-50/60">
          <CardContent className="space-y-1 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-green-800">
              <Check className="h-4 w-4" />
              This is now your active postcard
            </h3>
            <p className="text-sm text-green-700/90">
              Here&apos;s how it will print, front and back. The back&apos;s right half is kept clear for the
              address the printer adds. You can send straight away.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <PostcardPreview frontUrl={confirmFrontUrl} backUrl={savedBackUrl} onAddBack={addBack} />
          </CardContent>
        </Card>

        {!savedBackUrl && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No back design yet. The back will print blank apart from the address area.{' '}
            {addBack && (
              <button
                type="button"
                onClick={addBack}
                className="font-medium underline underline-offset-2"
              >
                Add a back design
              </button>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {onBackToOptions && (
            <Button onClick={onBackToOptions}>Done</Button>
          )}
          <Button variant="outline" onClick={() => setConfirmFrontUrl(null)}>
            Back to templates
          </Button>
        </div>
      </div>
    )
  }

  /* ----------------------------- Chooser step ----------------------------- */
  if (!template || !values) {
    return (
      <div className="space-y-6">
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="space-y-1 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Design your postcard in the browser</h3>
            <p className="text-sm text-slate-600">
              Pick a template, edit the text and colour, and see it update live. When you&apos;re happy,
              &ldquo;Use this design&rdquo; saves it as your postcard front and back — print-ready at A6 300 DPI.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SVG_TEMPLATES.map((t) => (
            <Card
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => chooseTemplate(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  chooseTemplate(t.id)
                }
              }}
              className="group cursor-pointer overflow-hidden transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <SvgFrame svgString={t.render(t.defaults)} className="border-b border-slate-100" />
              <CardContent className="space-y-1.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">{t.name}</h4>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {t.suits}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{t.description}</p>
                <p className="text-[11px] font-medium text-slate-400">Front &amp; back included</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {savedUrl && (
          <p className="text-xs text-slate-500">
            You already have a design saved. Choosing a template and using it replaces your front and back.
          </p>
        )}

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          Prefer to design elsewhere? You can also{' '}
          {onUseUpload ? (
            <button
              type="button"
              onClick={onUseUpload}
              className="font-medium text-slate-900 underline underline-offset-2"
            >
              upload a print-ready PDF
            </button>
          ) : (
            <span className="font-medium text-slate-900">upload a print-ready PDF</span>
          )}{' '}
          from Canva, a shared Drive folder, or your own design tool.
        </div>
      </div>
    )
  }

  /* ------------------------------ Editor step ----------------------------- */
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedId(null)
            setValues(null)
          }}
          className="-ml-2 text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          All templates
        </Button>
        <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-slate-500 hover:text-slate-900">
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Reset
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Live preview — first on mobile so edits are visible immediately. */}
        <div className="order-first space-y-3 lg:order-last lg:sticky lg:top-4">
          <Card className="overflow-hidden">
            <SvgFrame svgString={previewSvg} />
          </Card>
          <p className="text-center text-xs text-slate-500">
            Front · {template.name} · A6 landscape ({CARD_W}×{CARD_H}px @ 300 DPI)
          </p>
          <Card className="overflow-hidden">
            <SvgFrame svgString={previewBackSvg} />
          </Card>
          <p className="text-center text-xs text-slate-500">
            Back · your design fills the left half; the address prints on the right
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleUse} disabled={saving || !userId} className="flex-1">
              {saving ? (
                'Saving…'
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Use this design
                </>
              )}
            </Button>
          </div>
          {savedUrl && !saving && (
            <p className="flex items-center gap-1.5 text-xs text-green-600">
              <Check className="h-3.5 w-3.5" />
              Saved as your front design.{' '}
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-500 underline"
              >
                View file <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          )}
        </div>

        {/* Edit form */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4">
              {TEMPLATE_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`field-${field.key}`}
                    value={values[field.key]}
                    placeholder={field.placeholder}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="field-accent">Accent colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="field-accent"
                    type="color"
                    value={values.accent}
                    onChange={(e) => setValues({ ...values, accent: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded-md border border-slate-200 bg-transparent p-1"
                    aria-label="Accent colour"
                  />
                  <Input
                    value={values.accent}
                    onChange={(e) => setValues({ ...values, accent: e.target.value })}
                    className="max-w-[10rem] font-mono"
                  />
                </div>
              </div>
            </div>

            <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
              Text is kept inside the safe margin and auto-shrinks to fit, so nothing is cut when the card is
              trimmed. Long lines will scale down automatically.
            </p>

            {onUseUpload && (
              <Button variant="outline" size="sm" onClick={onUseUpload} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Or upload your own print-ready PDF
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
