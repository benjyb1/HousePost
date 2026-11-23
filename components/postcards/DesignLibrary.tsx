'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Trash2, LayoutTemplate, Upload as UploadIcon, Loader2, Pencil } from 'lucide-react'
import { PostcardPreview } from './PostcardPreview'

/**
 * The saved-designs LIBRARY on the Postcard design section.
 *
 * Lists the designs the user has made/uploaded, lets them preview any one (front
 * + back, incl. the reserved address half) and set it as the ACTIVE postcard.
 * "Active" = the `profiles.postcard_design_url` / `postcard_design_back_url`
 * pointers the send pipeline reads; setting active copies a row's urls onto them
 * via the existing PATCH /api/settings route. It never changes how those
 * pointers are read.
 */

type SavedDesign = {
  id: string
  label: string
  source: 'template' | 'upload'
  front_url: string
  back_url: string | null
  created_at: string
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url)
}

/** Small front thumbnail for the list. */
function Thumb({ url, source }: { url: string; source: SavedDesign['source'] }) {
  return (
    <div
      className="relative h-12 w-[68px] shrink-0 overflow-hidden rounded-[3px] border border-line bg-paper"
      style={{ aspectRatio: '148/105' }}
    >
      {isPdfUrl(url) ? (
        <div className="flex h-full w-full items-center justify-center">
          {source === 'template' ? (
            <LayoutTemplate className="h-4 w-4 text-ink-2/70" />
          ) : (
            <UploadIcon className="h-4 w-4 text-ink-2/70" />
          )}
        </div>
      ) : (
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  )
}

export function DesignLibrary({
  onGoToUpload,
  onEditTemplate,
}: {
  onGoToUpload?: () => void
  /**
   * Reopen a saved TEMPLATE design in the editor. The page wires this to switch
   * to the template editor and load the design's sidecar. Only shown for
   * `source: 'template'` rows.
   */
  onEditTemplate?: (design: SavedDesign) => void
}) {
  const [designs, setDesigns] = useState<SavedDesign[]>([])
  const [activeFront, setActiveFront] = useState<string | null>(null)
  const [activeBack, setActiveBack] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [designsRes, settingsRes] = await Promise.all([
        fetch('/api/postcards/designs', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
      ])
      const designsJson = await designsRes.json()
      const settingsJson = await settingsRes.json()
      const list: SavedDesign[] = designsJson.designs ?? []
      setDesigns(list)
      setActiveFront(settingsJson.profile?.postcard_design_url ?? null)
      setActiveBack(settingsJson.profile?.postcard_design_back_url ?? null)
      // Default the selection to the active design if it's in the library.
      const activeMatch = list.find((d) => d.front_url === settingsJson.profile?.postcard_design_url)
      setSelectedId((prev) => prev ?? activeMatch?.id ?? list[0]?.id ?? null)
    } catch {
      toast.error('Could not load your saved designs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = designs.find((d) => d.id === selectedId) ?? null
  const isActive = (d: SavedDesign) => d.front_url === activeFront
  const selectedIsActive =
    selected != null && selected.front_url === activeFront && (selected.back_url ?? null) === (activeBack ?? null)

  async function setActive() {
    if (!selected) return
    setSaving(true)
    try {
      // Always set the front. Set the back only when this design has one, so a
      // template (front only) can keep an existing uploaded back rather than
      // wiping it. The send pipeline still just reads these two pointers.
      const payload: Record<string, string> = { postcard_design_url: selected.front_url }
      if (selected.back_url) payload.postcard_design_back_url = selected.back_url

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to set active design')
      }
      setActiveFront(selected.front_url)
      if (selected.back_url) setActiveBack(selected.back_url)
      toast.success('Active postcard updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set active design')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/postcards/designs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to remove design')
      }
      setDesigns((prev) => prev.filter((d) => d.id !== id))
      if (selectedId === id) setSelectedId(null)
      toast.success('Removed from your library')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove design')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your saved designs…
        </CardContent>
      </Card>
    )
  }

  if (designs.length === 0) return null

  // Which back to show in the preview: the selected design's own back, or — for a
  // template with no back — the currently active back so the preview reflects the
  // real posted card.
  const previewBack = selected?.back_url ?? (selected && !selected.back_url ? activeBack : null)

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Your saved designs</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            Pick a saved design to preview it and set it as your active postcard.
          </p>
        </div>

        {/* Selector list */}
        <div className="space-y-2" role="listbox" aria-label="Saved designs">
          {designs.map((d) => {
            const active = isActive(d)
            const isSel = d.id === selectedId
            return (
              <div
                key={d.id}
                className={`flex items-center gap-3 rounded-md border p-2.5 transition-colors ${
                  isSel ? 'border-navy bg-paper' : 'border-line hover:border-line-2'
                }`}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => setSelectedId(d.id)}
                  className="flex flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy"
                >
                  <Thumb url={d.front_url} source={d.source} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink">{d.label}</span>
                      {active && <span className="text-xs font-semibold text-navy-ink">Active</span>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
                      {d.source === 'template' ? 'Template' : 'Uploaded'}
                      {d.back_url ? ' · front + back' : ' · front only'}
                    </span>
                  </span>
                </button>
                {onEditTemplate && d.source === 'template' && (
                  <button
                    type="button"
                    onClick={() => onEditTemplate(d)}
                    aria-label={`Edit ${d.label}`}
                    className="shrink-0 rounded-[3px] p-2 text-ink-2 transition-colors hover:bg-linen hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  aria-label={`Remove ${d.label} from your library`}
                  className="shrink-0 rounded-[3px] p-2 text-ink-2 transition-colors hover:bg-linen hover:text-[#8a3324]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Preview of the selected design */}
        {selected && (
          <div className="space-y-4 border-t border-line pt-5">
            <PostcardPreview
              frontUrl={selected.front_url}
              backUrl={previewBack}
              onAddBack={onGoToUpload}
            />

            {!selected.back_url && !activeBack && (
              <p className="rounded-md bg-linen px-3 py-2 text-sm text-ink">
                This design has no back yet, so the back will print as the reserved address area only.{' '}
                {onGoToUpload && (
                  <button type="button" onClick={onGoToUpload} className="font-semibold text-navy-ink underline underline-offset-4">
                    Add a back design
                  </button>
                )}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={setActive} disabled={saving || selectedIsActive}>
                {selectedIsActive ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Current active design
                  </>
                ) : saving ? (
                  'Saving…'
                ) : (
                  'Set as active design'
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
