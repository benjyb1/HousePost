'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowLeft, Check, RotateCcw, Upload, ExternalLink, Undo2, Redo2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PostcardPreview } from './PostcardPreview'
import { useHistory } from './useHistory'
import {
  SVG_TEMPLATES,
  getTemplate,
  TEMPLATE_FIELDS,
  TEMPLATE_BACK_FIELDS,
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
  onDirtyChange,
  guard: guardProp,
}: {
  onUseUpload?: () => void
  /** Open the uploader on the BACK side (falls back to onUseUpload). */
  onAddBack?: () => void
  onBackToOptions?: () => void
  /** Called whenever the editor has unsaved edits (or stops having them). */
  onDirtyChange?: (dirty: boolean) => void
  /** Wrap navigation away from the editor so the page can ask about unsaved edits. */
  guard?: (action: () => void) => void
}) {
  const addBack = onAddBack ?? onUseUpload
  const guard = guardProp ?? ((fn: () => void) => fn())
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const history = useHistory<TemplateValues | null>(null)
  const values = history.value
  const { undo, redo } = history
  // Which side the big preview shows. Focusing a field flips it to that side.
  const [side, setSide] = useState<'front' | 'back'>('front')
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

  // JSON of the values as last chosen/saved; dirty = current values differ from it.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const dirty = values !== null && savedSnapshot !== null && JSON.stringify(values) !== savedSnapshot
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  // Unmount clears it so the page doesn't keep guarding for an editor that's gone.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const template = selectedId ? getTemplate(selectedId) : undefined

  // ⌘Z / Ctrl+Z undo, with Shift for redo, while a template is open.
  useEffect(() => {
    if (!template) return
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault() // take over from the input's native undo so the two never disagree
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [template, undo, redo])

  /** Every form edit goes through here so it lands in the undo stack. */
  function edit(key: keyof TemplateValues, next: string) {
    if (!values) return
    history.set({ ...values, [key]: next }, key)
  }

  function chooseTemplate(id: string) {
    const t = getTemplate(id)
    if (!t) return
    setSelectedId(id)
    setSide('front')
    history.reset({ ...t.defaults })
    setSavedSnapshot(JSON.stringify(t.defaults))
  }

  /** Reset is itself an undo step, so a slip of the mouse doesn't lose work. */
  function resetToDefaults() {
    if (template) history.set({ ...template.defaults })
  }

  function backToTemplates() {
    setSelectedId(null)
    history.reset(null)
    setSavedSnapshot(null)
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
      // A template is a matched pair: rasterise the front AND the coordinated
      // back. The back keeps its design on the left half with the right half
      // white, so the printer prints the address over it — the same full card
      // the uploader composites for an uploaded back.
      const [frontBlob, backBlob] = await Promise.all([
        svgToPngBlob(template.render(values)),
        svgToPngBlob(template.renderBack(values)),
      ])

      // Same storage keys + upload options the uploader uses for each side.
      const storage = supabase.storage.from('postcard-designs')
      const frontPath = `${userId}/design.png`
      const backPath = `${userId}/design-back.png`

      const [frontUpload, backUpload] = await Promise.all([
        storage.upload(frontPath, frontBlob, { upsert: true, contentType: 'image/png' }),
        storage.upload(backPath, backBlob, { upsert: true, contentType: 'image/png' }),
      ])
      if (frontUpload.error) throw frontUpload.error
      if (backUpload.error) throw backUpload.error

      // Cache-bust exactly like the uploader — the storage keys are fixed, so a
      // fresh version query forces the new bytes everywhere the URLs are used.
      const stamp = Date.now()
      const frontUrl = `${storage.getPublicUrl(frontPath).data.publicUrl}?v=${stamp}`
      const backUrl = `${storage.getPublicUrl(backPath).data.publicUrl}?v=${stamp}`

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcard_design_url: frontUrl,
          postcard_design_back_url: backUrl,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to save')
      }

      setSavedUrl(frontUrl)
      setSavedBackUrl(backUrl)
      setSavedSnapshot(JSON.stringify(values))

      // Also record the pair in the saved-designs LIBRARY.
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
              Here&apos;s how it will print, front and back. The matching back sits on the left half; the
              right half is reserved for the address the printer adds. You can send straight away.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <PostcardPreview frontUrl={confirmFrontUrl} backUrl={savedBackUrl} onAddBack={addBack} />
          </CardContent>
        </Card>

        {addBack && (
          <p className="text-sm text-slate-500">
            Prefer your own back?{' '}
            <button
              type="button"
              onClick={addBack}
              className="font-medium text-slate-900 underline underline-offset-2"
            >
              Upload a back design
            </button>{' '}
            to replace it.
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
              Pick a template, then edit both sides — the front and its own matching back — and see them
              update live. When you&apos;re happy, &ldquo;Use this design&rdquo; saves both sides, print-ready
              at A6 300 DPI.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <CardContent className="space-y-1 p-4">
                <h4 className="text-sm font-semibold text-slate-900">{t.name}</h4>
                <p className="text-xs text-slate-500">{t.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {savedUrl && (
          <p className="text-xs text-slate-500">
            You already have a design saved. Choosing a template and using it replaces both the front and
            the back.
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
          onClick={() => guard(backToTemplates)}
          className="-ml-2 text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          All templates
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!history.canUndo}
            aria-label="Undo"
            title="Undo (⌘Z)"
            className="text-slate-500 hover:text-slate-900"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!history.canRedo}
            aria-label="Redo"
            title="Redo (⇧⌘Z)"
            className="text-slate-500 hover:text-slate-900"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-slate-500 hover:text-slate-900">
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Live preview — first on mobile so edits are visible immediately. */}
        <div className="order-first space-y-3 lg:order-last lg:sticky lg:top-4">
          <div className="flex items-center justify-center">
            <div
              role="tablist"
              aria-label="Postcard side"
              className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-sm"
            >
              {(['front', 'back'] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  type="button"
                  aria-selected={side === s}
                  onClick={() => setSide(s)}
                  className={`rounded px-4 py-1.5 font-medium transition ${
                    side === s ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
          </div>
          <figure className="space-y-1.5">
            <Card className="overflow-hidden">
              <SvgFrame svgString={side === 'front' ? previewSvg : previewBackSvg} />
            </Card>
            <figcaption className="text-center text-xs font-medium text-slate-500">
              {side === 'front' ? 'Front' : 'Back · right half kept clear for the address'}
            </figcaption>
          </figure>
          <p className="text-center text-xs text-slate-500">
            Live preview · {template.name} · A6 landscape ({CARD_W}×{CARD_H}px @ 300 DPI)
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
              Saved as your postcard front and back.{' '}
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
          <CardContent className="space-y-6 p-5">
            {/* Front + shared brand */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Front &amp; brand
              </h4>
              <div className="grid gap-4">
                {TEMPLATE_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`field-${field.key}`}
                      value={values[field.key]}
                      placeholder={field.placeholder}
                      onFocus={() => setSide('front')}
                      onChange={(e) => edit(field.key, e.target.value)}
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
                      onFocus={() => setSide('front')}
                      onChange={(e) => edit('accent', e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-md border border-slate-200 bg-transparent p-1"
                      aria-label="Accent colour"
                    />
                    <Input
                      value={values.accent}
                      onFocus={() => setSide('front')}
                      onChange={(e) => edit('accent', e.target.value)}
                      className="max-w-[10rem] font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Back of card — its own content */}
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Back of card
                </h4>
                <p className="mt-1 text-xs text-slate-400">
                  Its own headline, message and call to action. The back also uses the business name, phone,
                  website and colour from above.
                </p>
              </div>
              <div className="grid gap-4">
                {TEMPLATE_BACK_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                    {field.multiline ? (
                      <textarea
                        id={`field-${field.key}`}
                        value={values[field.key]}
                        placeholder={field.placeholder}
                        rows={3}
                        onFocus={() => setSide('back')}
                        onChange={(e) => edit(field.key, e.target.value)}
                        className="border-input placeholder:text-muted-foreground dark:bg-input/30 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                      />
                    ) : (
                      <Input
                        id={`field-${field.key}`}
                        value={values[field.key]}
                        placeholder={field.placeholder}
                        onFocus={() => setSide('back')}
                        onChange={(e) => edit(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
              Text is kept inside the safe margin and auto-shrinks to fit, so nothing is cut when the card is
              trimmed. The back message wraps to a few lines. The right half of the back stays clear for the
              address the printer adds.
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
