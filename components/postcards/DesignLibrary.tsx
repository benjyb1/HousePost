'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Trash2, LayoutTemplate, Upload as UploadIcon, Loader2, Pencil } from 'lucide-react'
import { PostcardPreview } from './PostcardPreview'
import { isDesignInUse } from '@/lib/utils/design-files'
import chrome from '@/components/portal/page-chrome.module.css'

/**
 * The saved-designs LIBRARY on the Designs page.
 *
 * A grid of postcard thumbnails. Picking one shows both sides below the grid
 * and lets the user set it as the ACTIVE postcard. "Active" = the
 * `profiles.postcard_design_url` / `postcard_design_back_url` pointers the send
 * pipeline reads; setting active copies a row's urls onto them via the existing
 * PATCH /api/settings route. It never changes how those pointers are read.
 *
 * The API already folds older duplicate rows (same files, different `?v=`)
 * into one entry. The design in use can't be deleted; everything else can,
 * after a small inline confirm.
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

const UK_TIME_ZONE = 'Europe/London'

/** "Saved 27 Nov", with the year added when it isn't this year. */
function savedOn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const yearOf = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: UK_TIME_ZONE }).format(d)
  const thisYear = yearOf(date) === yearOf(new Date())
  const day = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: 'numeric' }),
    timeZone: UK_TIME_ZONE,
  }).format(date)
  return `Saved ${day}`
}

/** The front of the card at A6 landscape. PDFs can't be drawn as an image, so they get an icon. */
function Thumb({ url, source }: { url: string; source: SavedDesign['source'] }) {
  const [broken, setBroken] = useState(false)
  return (
    <div
      className="relative w-full overflow-hidden rounded-[3px] border border-line bg-white"
      style={{ aspectRatio: '148/105' }}
    >
      {isPdfUrl(url) ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-paper text-ink-2">
          {source === 'template' ? (
            <LayoutTemplate className="h-5 w-5 text-ink-2/70" aria-hidden="true" />
          ) : (
            <UploadIcon className="h-5 w-5 text-ink-2/70" aria-hidden="true" />
          )}
          <span className="text-[12px]">PDF</span>
        </div>
      ) : broken ? (
        <div className="flex h-full w-full items-center justify-center bg-paper px-3 text-center text-[12px] text-ink-2">
          Picture not available
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- public storage URL, shown as saved
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
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
  // The card showing "Delete this design?", and the one whose delete is in flight.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const deleteButtons = useRef(new Map<string, HTMLButtonElement>())

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
      const front: string | null = settingsJson.profile?.postcard_design_url ?? null
      const back: string | null = settingsJson.profile?.postcard_design_back_url ?? null
      setDesigns(list)
      setActiveFront(front)
      setActiveBack(back)
      // Start on the design in use, if it's in the library.
      const inUse = list.find((d) => isDesignInUse(d, front, back))
      setSelectedId((prev) => prev ?? inUse?.id ?? list[0]?.id ?? null)
    } catch {
      toast.error('Could not load your saved designs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Opening the confirm puts focus on the safe choice.
  useEffect(() => {
    if (confirmingId) keepRef.current?.focus()
  }, [confirmingId])

  const selected = designs.find((d) => d.id === selectedId) ?? null
  const inUse = (d: SavedDesign) => isDesignInUse(d, activeFront, activeBack)
  const selectedInUse = selected != null && inUse(selected)

  function select(id: string) {
    setSelectedId(id)
    // On a phone the preview sits below the whole grid, so bring it into view.
    requestAnimationFrame(() => {
      const el = detailRef.current
      if (!el || el.getBoundingClientRect().top < window.innerHeight - 120) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    })
  }

  function cancelDelete(id: string) {
    setConfirmingId(null)
    requestAnimationFrame(() => deleteButtons.current.get(id)?.focus())
  }

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
        throw new Error(error ?? 'Could not change your active design')
      }
      setActiveFront(selected.front_url)
      if (selected.back_url) setActiveBack(selected.back_url)
      toast.success('Active postcard updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change your active design')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/postcards/designs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }))
        throw new Error(error ?? 'Could not delete that design. Please try again.')
      }
      const remaining = designs.filter((d) => d.id !== id)
      setDesigns(remaining)
      setConfirmingId(null)
      if (selectedId === id) {
        const next = remaining.find((d) => isDesignInUse(d, activeFront, activeBack)) ?? remaining[0]
        setSelectedId(next?.id ?? null)
      }
      toast.success('Design deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete that design. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <section className={chrome.panel}>
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your saved designs…
        </p>
      </section>
    )
  }

  if (designs.length === 0) return null

  // Which back to show in the preview: the selected design's own back, or — for a
  // design with no back — the currently active back so the preview reflects the
  // real posted card.
  const previewBack = selected?.back_url ?? (selected && !selected.back_url ? activeBack : null)

  return (
    <section className={chrome.panel} aria-labelledby="saved-designs-heading">
      <h2 id="saved-designs-heading" className="text-[17px] font-semibold leading-tight text-ink">
        Your saved designs
      </h2>
      <p className="mt-1 text-[15px] leading-normal text-ink-2">
        Pick a design to see both sides. You can make any of them the card we send.
      </p>

      <div className="@container mt-5">
        <ul
          aria-label="Saved designs"
          className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4"
        >
          {designs.map((d) => {
            const active = inUse(d)
            const isSel = d.id === selectedId
            const canEdit = Boolean(onEditTemplate) && d.source === 'template'
            const confirming = confirmingId === d.id
            const deleting = deletingId === d.id
            return (
              <li key={d.id} className="min-w-0">
                <div
                  className={`flex h-full flex-col rounded-md border bg-paper-hi transition-colors ${
                    isSel
                      ? 'border-navy shadow-[inset_0_0_0_1px_var(--color-navy)]'
                      : 'border-line hover:border-line-2'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => select(d.id)}
                    aria-pressed={isSel}
                    className="flex flex-1 flex-col gap-2.5 rounded-[5px] p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                  >
                    <Thumb url={d.front_url} source={d.source} />
                    <span className="block px-0.5 pb-0.5">
                      <span className="block text-[14px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                        {d.label}
                      </span>
                      <span className="mt-1 block text-[13px] leading-snug text-ink-2">
                        {savedOn(d.created_at)} · {d.back_url ? 'Front and back' : 'Front only'}
                      </span>
                      {active && (
                        <span className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold text-navy-ink">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                          In use
                        </span>
                      )}
                    </span>
                  </button>

                  {(canEdit || !active) && (
                    <div className="border-t border-line px-1.5">
                      {confirming ? (
                        <div
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-1 py-2"
                          onKeyDown={(e) => {
                            if (e.key === 'Escape' && !deleting) cancelDelete(d.id)
                          }}
                        >
                          <span className="text-[13px] font-semibold text-ink">Delete this design?</span>
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => remove(d.id)}
                              disabled={deleting}
                              aria-busy={deleting}
                              className="relative rounded-[3px] bg-destructive px-2.5 py-1.5 text-[13px] after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-[''] font-semibold text-white transition-[filter] hover:brightness-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-60"
                            >
                              {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                            <button
                              ref={keepRef}
                              type="button"
                              onClick={() => cancelDelete(d.id)}
                              disabled={deleting}
                              className="relative rounded-[3px] px-2.5 py-1.5 text-[13px] font-semibold text-navy-ink after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-[''] hover:bg-linen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-60"
                            >
                              Keep it
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="flex min-h-11 items-center justify-between gap-2">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => onEditTemplate?.(d)}
                              aria-label={`Edit ${d.label}`}
                              className="relative inline-flex items-center gap-1.5 rounded-[3px] px-2 py-2 text-[13px] font-semibold after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] text-navy-ink transition-colors hover:bg-linen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </button>
                          ) : (
                            <span />
                          )}
                          {!active && (
                            <button
                              ref={(el) => {
                                if (el) deleteButtons.current.set(d.id, el)
                                else deleteButtons.current.delete(d.id)
                              }}
                              type="button"
                              onClick={() => setConfirmingId(d.id)}
                              aria-label={`Delete ${d.label}`}
                              className="relative inline-flex items-center gap-1.5 rounded-[3px] px-2 py-2 text-[13px] font-semibold after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] text-ink-2 transition-colors hover:bg-linen hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Both sides of the selected design */}
      {selected && (
        <div ref={detailRef} className="mt-6 scroll-mt-6 space-y-4 border-t border-line pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{selected.label}</h3>
            <span className="text-[13px] text-ink-2">{savedOn(selected.created_at)}</span>
          </div>

          <PostcardPreview frontUrl={selected.front_url} backUrl={previewBack} onAddBack={onGoToUpload} />

          {!selected.back_url && !activeBack && (
            <p className="rounded-md bg-linen px-3 py-2 text-sm text-ink">
              This design has no back yet, so the back will print as the reserved address area only.{' '}
              {onGoToUpload && (
                <button
                  type="button"
                  onClick={onGoToUpload}
                  className="font-semibold text-navy-ink underline underline-offset-4"
                >
                  Add a back design
                </button>
              )}
            </p>
          )}

          {selectedInUse ? (
            <p className="flex items-start gap-2 text-sm leading-normal text-ink">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-navy" strokeWidth={2.5} aria-hidden="true" />
              <span>
                This is the card being sent. To delete it, set another design as active first.
              </span>
            </p>
          ) : (
            <Button onClick={setActive} disabled={saving}>
              {saving ? 'Saving…' : 'Set as active design'}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
