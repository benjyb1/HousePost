'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, Trash2, ImageIcon, Eye, Sparkles, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PostcardPreview } from './PostcardPreview'

// Cards print A6 (148×105mm). Artwork is supplied at 154×111mm (A6 + 3mm bleed
// on every edge) and 3mm is trimmed off all round, so the design must run past
// the trim; whatever sits in that outer 3mm band gets cut away.
//
// FRONT: the design fills the whole card, edge to edge.
// BACK:  the postage, recipient address and barcode are printed over the RIGHT
//        HALF of the card (measured from a live proof: it splits dead on the
//        centre line). So the customer's back design only occupies the LEFT half.
//        We crop their artwork to that left half and composite it onto a full A6
//        card (right half left white) before sending.
const CARD = {
  trimW: 148, // mm
  trimH: 105,
  bleed: 3, // trimmed off every edge (154×111mm artwork → 148×105mm trim)
  safe: 3, // the A6 safe zone is 142×99mm, i.e. 3mm inside the trim
}
const DOC_W = CARD.trimW + CARD.bleed * 2 // 154mm — full artwork width incl. bleed
const DOC_H = CARD.trimH + CARD.bleed * 2 // 111mm

// Crop-frame aspect ratios. "full" = whole card; "back" = the left-half design
// area (half the card width). With/without the bleed we add for the customer.
const ASPECT = {
  fullBleed: DOC_W / DOC_H, // 154 / 111
  fullTrim: CARD.trimW / CARD.trimH, // 148 / 105
  backBleed: DOC_W / 2 / DOC_H, // 77 / 111  (left half + outer bleed)
  backTrim: CARD.trimW / 2 / CARD.trimH, // 74 / 105
}

// Cards print at 300 DPI. Below that an A6 card starts to look soft, so warn
// before the customer commits a design that'll print blurry.
const MIN_PRINT_DPI = 300
// Finished artwork in pixels at 300 DPI: the whole card, and the left half.
const TARGET_PX = {
  w: Math.round((DOC_W / 25.4) * 300), // 1819 — full card
  h: Math.round((DOC_H / 25.4) * 300), // 1311
}
const HALF_PX_W = Math.round(TARGET_PX.w / 2) // 910 — left (design) half

type Side = 'front' | 'back'

const SIDE_CONFIG = {
  front: { fileBase: 'design', settingsKey: 'postcard_design_url', label: 'Front' },
  back: { fileBase: 'design-back', settingsKey: 'postcard_design_back_url', label: 'Back' },
} as const

const pct = (mm: number, frameMm: number) => (mm / frameMm) * 100

/**
 * Dashed guide insets (% per edge) for a crop frame. `kind` is the whole card or
 * the back's left-half design area, whose RIGHT edge is the card centre — not a
 * cut — so it stays flush.
 */
function guideInsets(kind: 'full' | 'back', addBleed: boolean) {
  const off = addBleed ? 0 : CARD.bleed
  const frameW = kind === 'full' ? (addBleed ? CARD.trimW : DOC_W) : addBleed ? CARD.trimW / 2 : DOC_W / 2
  const frameH = addBleed ? CARD.trimH : DOC_H
  const rightFlush = kind === 'back'
  return {
    cut: { l: pct(off, frameW), r: rightFlush ? 0 : pct(off, frameW), t: pct(off, frameH), b: pct(off, frameH) },
    safe: {
      l: pct(off + CARD.safe, frameW),
      r: rightFlush ? 0 : pct(off + CARD.safe, frameW),
      t: pct(off + CARD.safe, frameH),
      b: pct(off + CARD.safe, frameH),
    },
  }
}

type Insets = { l: number; r: number; t: number; b: number }

/** A dashed rectangle (red cut line or blue safe line) at the given edge insets. */
function GuideBox({ insets, variant }: { insets: Insets; variant: 'cut' | 'safe' }) {
  const cut = variant === 'cut'
  return (
    <div
      className="pointer-events-none absolute rounded-[1px] border border-dashed"
      style={{
        left: `${insets.l}%`,
        right: `${insets.r}%`,
        top: `${insets.t}%`,
        bottom: `${insets.b}%`,
        borderColor: cut ? 'rgba(239,68,68,0.9)' : 'rgba(37,99,235,0.9)',
        ...(cut ? { boxShadow: '0 0 0 9999px rgba(15,23,42,0.20)' } : {}),
      }}
    />
  )
}

/** Cut + safe guides for whichever frame is showing. */
function Guides({ kind, addBleed }: { kind: 'full' | 'back'; addBleed: boolean }) {
  const { cut, safe } = guideInsets(kind, addBleed)
  return (
    <>
      {!addBleed && <GuideBox insets={cut} variant="cut" />}
      <GuideBox insets={safe} variant="safe" />
    </>
  )
}

/**
 * The address half of the back, shown next to the design so it's obvious the
 * design only occupies the left half. The real address + postage are printed
 * here over a white panel.
 */
function AddressHalf() {
  return (
    <div className="relative flex w-1/2 flex-col justify-between border-l-2 border-dashed border-amber-400 bg-amber-50/50 p-3">
      <div className="flex justify-end">
        <div className="flex h-9 w-7 items-center justify-center rounded-sm border-2 border-dashed border-slate-300 text-[7px] font-medium text-slate-400">
          STAMP
        </div>
      </div>
      <div className="space-y-0.5 text-[10px] leading-tight text-slate-500">
        <p>Mr A. Homeowner</p>
        <p>1 Example Street</p>
        <p>Sometown</p>
        <p>AB12 3CD</p>
        <div className="mt-1 h-3 w-20 bg-[repeating-linear-gradient(90deg,#94a3b8_0,#94a3b8_2px,transparent_2px,transparent_4px)]" />
      </div>
      <p className="text-[8px] font-medium uppercase tracking-wide text-amber-600">
        Address &amp; postage added automatically
      </p>
    </div>
  )
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))), 'image/png')
  })
}

/**
 * Crop the chosen area to a canvas, optionally synthesising the 3mm bleed by
 * replicating edge pixels outward (for artwork that doesn't already include it).
 * `rightIsCut` is false for the back's left-half design — its right edge is the
 * card centre, which is never cut, so it gets no bleed there.
 */
function cropWithBleed(image: HTMLImageElement, cropArea: Area, addBleed: boolean, rightIsCut: boolean, trimWmm: number): HTMLCanvasElement {
  const cw = Math.round(cropArea.width)
  const ch = Math.round(cropArea.height)

  if (!addBleed) {
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    c.getContext('2d')!.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cw, ch)
    return c
  }

  const bx = Math.max(1, Math.round((cw * CARD.bleed) / trimWmm))
  const by = Math.max(1, Math.round((ch * CARD.bleed) / CARD.trimH))
  const rb = rightIsCut ? bx : 0

  const canvas = document.createElement('canvas')
  canvas.width = cw + bx + rb
  canvas.height = ch + by * 2
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, bx, by, cw, ch)
  ctx.drawImage(canvas, bx, by, 1, ch, 0, by, bx, ch) // left
  ctx.drawImage(canvas, bx, by, cw, 1, bx, 0, cw, by) // top
  ctx.drawImage(canvas, bx, by + ch - 1, cw, 1, bx, by + ch, cw, by) // bottom
  ctx.drawImage(canvas, bx, by, 1, 1, 0, 0, bx, by) // top-left
  ctx.drawImage(canvas, bx, by + ch - 1, 1, 1, 0, by + ch, bx, by) // bottom-left
  if (rb) {
    ctx.drawImage(canvas, bx + cw - 1, by, 1, ch, bx + cw, by, rb, ch) // right
    ctx.drawImage(canvas, bx + cw - 1, by, 1, 1, bx + cw, 0, rb, by) // top-right
    ctx.drawImage(canvas, bx + cw - 1, by + ch - 1, 1, 1, bx + cw, by + ch, rb, by) // bottom-right
  }
  return canvas
}

/**
 * Produce the final artwork PNG for a side. The front is the cropped card. The
 * back is the cropped LEFT half composited onto a full A6 card with a white
 * right half — the area filled with the address.
 */
async function getCroppedImg(imageSrc: string, cropArea: Area, addBleed: boolean, side: Side): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const rightIsCut = side === 'front'
  const trimWmm = side === 'front' ? CARD.trimW : CARD.trimW / 2
  const cropped = cropWithBleed(image, cropArea, addBleed, rightIsCut, trimWmm)

  if (side === 'front') return canvasToBlob(cropped)

  // Back: design on the left half, white right half for the address.
  const full = document.createElement('canvas')
  full.width = TARGET_PX.w
  full.height = TARGET_PX.h
  const ctx = full.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, full.width, full.height)
  ctx.drawImage(cropped, 0, 0, cropped.width, cropped.height, 0, 0, HALF_PX_W, TARGET_PX.h)
  return canvasToBlob(full)
}

export function UploadCustomDesign({
  onBackToOptions,
  initialSide = 'front',
}: {
  onBackToOptions?: () => void
  /** Which side to open on (the template editor sends people straight to the back). */
  initialSide?: Side
}) {
  const supabase = createClient()
  const frontFileInputRef = useRef<HTMLInputElement>(null)
  const backFileInputRef = useRef<HTMLInputElement>(null)
  const frontOriginalFile = useRef<File | null>(null)
  const backOriginalFile = useRef<File | null>(null)

  const [activeSide, setActiveSide] = useState<Side>(initialSide)
  const [userId, setUserId] = useState<string | null>(null)

  // Front side state
  const [frontDesignUrl, setFrontDesignUrl] = useState<string | null>(null)
  const [frontImageSrc, setFrontImageSrc] = useState<string | null>(null)
  const [frontCrop, setFrontCrop] = useState({ x: 0, y: 0 })
  const [frontZoom, setFrontZoom] = useState(1)
  const [frontCroppedAreaPixels, setFrontCroppedAreaPixels] = useState<Area | null>(null)
  const [frontImageAspect, setFrontImageAspect] = useState<number | null>(null)

  // Back side state
  const [backDesignUrl, setBackDesignUrl] = useState<string | null>(null)
  const [backImageSrc, setBackImageSrc] = useState<string | null>(null)
  const [backCrop, setBackCrop] = useState({ x: 0, y: 0 })
  const [backZoom, setBackZoom] = useState(1)
  const [backCroppedAreaPixels, setBackCroppedAreaPixels] = useState<Area | null>(null)
  const [backImageAspect, setBackImageAspect] = useState<number | null>(null)

  const [frontAddBleed, setFrontAddBleed] = useState(false)
  const [backAddBleed, setBackAddBleed] = useState(false)
  const [frontPassthrough, setFrontPassthrough] = useState(false)
  const [backPassthrough, setBackPassthrough] = useState(false)

  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // After a successful save, show the finished-card confirmation preview instead
  // of silently returning. Holds the resulting active front/back pair.
  const [confirmPair, setConfirmPair] = useState<{ front: string | null; back: string | null } | null>(null)

  // Derived state for whichever side is active
  const isFront = activeSide === 'front'
  const currentDesignUrl = isFront ? frontDesignUrl : backDesignUrl
  const setCurrentDesignUrl = isFront ? setFrontDesignUrl : setBackDesignUrl
  const imageSrc = isFront ? frontImageSrc : backImageSrc
  const setImageSrc = isFront ? setFrontImageSrc : setBackImageSrc
  const crop = isFront ? frontCrop : backCrop
  const setCrop = isFront ? setFrontCrop : setBackCrop
  const zoom = isFront ? frontZoom : backZoom
  const setZoom = isFront ? setFrontZoom : setBackZoom
  const croppedAreaPixels = isFront ? frontCroppedAreaPixels : backCroppedAreaPixels
  const setCroppedAreaPixels = isFront ? setFrontCroppedAreaPixels : setBackCroppedAreaPixels
  const imageAspect = isFront ? frontImageAspect : backImageAspect
  const setImageAspect = isFront ? setFrontImageAspect : setBackImageAspect
  const fileInputRef = isFront ? frontFileInputRef : backFileInputRef
  const originalFileRef = isFront ? frontOriginalFile : backOriginalFile
  const config = SIDE_CONFIG[activeSide]
  const addBleed = isFront ? frontAddBleed : backAddBleed
  const setAddBleed = isFront ? setFrontAddBleed : setBackAddBleed
  const passthrough = isFront ? frontPassthrough : backPassthrough
  const setPassthrough = isFront ? setFrontPassthrough : setBackPassthrough

  const bothSaved = Boolean(frontDesignUrl && backDesignUrl)

  // Crop frame for the active side: full card (front) or left half (back), with
  // or without the bleed we add. The back container is always a full card (the
  // cropper takes its left half, the address half sits to the right).
  const cropAspect = isFront
    ? addBleed ? ASPECT.fullTrim : ASPECT.fullBleed
    : addBleed ? ASPECT.backTrim : ASPECT.backBleed
  const backContainerAspect = addBleed ? ASPECT.fullTrim : ASPECT.fullBleed

  // DPI of the cropped artwork. The crop frame spans this many mm across.
  const cropFrameMm = isFront ? (addBleed ? CARD.trimW : DOC_W) : addBleed ? CARD.trimW / 2 : DOC_W / 2
  const effectiveDpi = croppedAreaPixels ? Math.round(croppedAreaPixels.width / (cropFrameMm / 25.4)) : null
  const lowRes = !passthrough && effectiveDpi != null && effectiveDpi < MIN_PRINT_DPI

  // Warn when the uploaded file's orientation is wrong for this side — it'll be
  // heavily cropped. Front wants landscape, the back's design half wants portrait.
  const targetPortrait = !isFront
  const uploadPortrait = imageAspect != null && imageAspect < 1
  const wrongShape = !passthrough && imageAspect != null && uploadPortrait !== targetPortrait

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      // 10.6: never read a stale design URL from the browser HTTP cache. The
      // stored URL is what every surface (this page, the send route, the print
      // proof) trusts as "the design", so it must reflect the latest save/remove
      // the instant we re-enter the section.
      const res = await fetch('/api/settings', { cache: 'no-store' })
      const { profile } = await res.json()
      setFrontDesignUrl(profile?.postcard_design_url ?? null)
      setBackDesignUrl(profile?.postcard_design_back_url ?? null)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [setCroppedAreaPixels])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    originalFileRef.current = file
    setRendering(true)
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)

    try {
      const arrayBuffer = await file.arrayBuffer()

      const renderPdf = async () => {
        const pdfjsLib = await import('pdfjs-dist')
        // Served from our own origin (copied into /public at build time by
        // scripts/copy-pdf-worker.mjs), so there's no third-party CDN to fail.
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page = await pdf.getPage(1)

        // Render at ~400 DPI so the cropped print is sharp with headroom above
        // the 300 DPI print spec. Cap the long edge so an oversized PDF doesn't
        // blow up the canvas/upload.
        const base = page.getViewport({ scale: 1 })
        const MAX_EDGE = 3200
        let scale = 400 / 72
        const longEdge = Math.max(base.width, base.height) * scale
        if (longEdge > MAX_EDGE) scale = MAX_EDGE / Math.max(base.width, base.height)

        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise
        setImageAspect(viewport.width / viewport.height)
        return canvas.toDataURL('image/png')
      }

      // The PDF worker can stall; race a timeout so the uploader surfaces an
      // error instead of sitting on "Rendering…" forever.
      const dataUrl = await Promise.race([
        renderPdf(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('PDF render timed out')), 25_000)),
      ])
      setImageSrc(dataUrl)
    } catch (err) {
      const timedOut = err instanceof Error && err.message === 'PDF render timed out'
      toast.error(
        timedOut
          ? 'That PDF took too long to render — check your connection and try again.'
          : 'Failed to render PDF — make sure it is a valid PDF file.'
      )
    } finally {
      setRendering(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (!imageSrc || !userId) return
    if (!passthrough && !croppedAreaPixels) return
    if (passthrough && !originalFileRef.current) return
    setLoading(true)

    try {
      const ext = passthrough ? 'pdf' : 'png'
      const contentType = passthrough ? 'application/pdf' : 'image/png'
      const blob: Blob = passthrough
        ? originalFileRef.current!
        : await getCroppedImg(imageSrc, croppedAreaPixels!, addBleed, activeSide)

      const path = `${userId}/${config.fileBase}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('postcard-designs')
        .upload(path, blob, { upsert: true, contentType })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('postcard-designs').getPublicUrl(path)
      // 10.6: the storage key is fixed per side, so overwriting reuses the same
      // object and the CDN/browser would otherwise keep serving the OLD bytes.
      // A fresh version query on every save busts that cache everywhere the URL
      // is used (this page, the print proof, and the send route).
      const versionedUrl = `${publicUrl}?v=${Date.now()}`

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.settingsKey]: versionedUrl }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to save')
      }

      // State is the source of truth for what shows as "the design" — update it
      // synchronously so the replacement is visible immediately, no refresh.
      setCurrentDesignUrl(versionedUrl)
      setImageSrc(null)
      setPreviewUrl(null) // design changed — the old proof is stale

      // The resulting active pair after this save (the other side is unchanged).
      const pair = isFront
        ? { front: versionedUrl, back: backDesignUrl }
        : { front: frontDesignUrl, back: versionedUrl }

      // Record it in the saved-designs LIBRARY. A front is required, so if only a
      // back exists so far we skip (the library entry appears once a front is in).
      // Best-effort: never undo the successful active save.
      if (pair.front) {
        try {
          await fetch('/api/postcards/designs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'upload', front_url: pair.front, back_url: pair.back }),
          })
        } catch {
          /* non-fatal */
        }
      }

      toast.success(`${config.label} design saved`)
      setConfirmPair(pair)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save design')
    } finally {
      setLoading(false)
    }
  }

  /** Render an exact print proof through the printer's test mode (nothing posted/charged). */
  async function handlePreview() {
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/postcards/preview', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to render preview')
      setPreviewUrl(data.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to render preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleRemove() {
    if (!userId) return
    setLoading(true)
    try {
      await supabase.storage
        .from('postcard-designs')
        .remove([`${userId}/${config.fileBase}.png`, `${userId}/${config.fileBase}.pdf`])
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.settingsKey]: null }),
      })
      // 10.6: clear it from state immediately so the removed design stops showing
      // as "the design" straight away, rather than lingering until a refresh.
      setCurrentDesignUrl(null)
      setImageSrc(null)
      setPreviewUrl(null)
      toast.success(`${config.label} design removed`)
    } catch {
      toast.error('Failed to remove design')
    } finally {
      setLoading(false)
    }
  }

  function cancelEdit() {
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setImageAspect(null)
    originalFileRef.current = null
  }

  // Per-side "design at this size" guidance.
  const sizeHint = isFront
    ? `Landscape · 154×111mm · ${TARGET_PX.w}×${TARGET_PX.h}px @ 300 DPI`
    : `Portrait (left half) · 77×111mm · ${HALF_PX_W}×${TARGET_PX.h}px @ 300 DPI`

  return (
    <div className="space-y-6">
      {/* Post-save confirmation — the finished card, front and back. */}
      {confirmPair && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Check className="h-5 w-5" />
              This is now your active postcard
            </CardTitle>
            <CardDescription className="text-green-700/90">
              Here&apos;s how it will print — front and back. The back&apos;s right half is reserved for the
              address the printer adds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PostcardPreview
              frontUrl={confirmPair.front}
              backUrl={confirmPair.back}
              onAddBack={() => {
                setConfirmPair(null)
                setActiveSide('back')
              }}
            />
            {!confirmPair.back && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                No back design yet. The back will print as the reserved address area only —{' '}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmPair(null)
                    setActiveSide('back')
                  }}
                  className="font-medium underline underline-offset-2"
                >
                  add a back design
                </button>
                .
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {onBackToOptions && <Button onClick={onBackToOptions}>Done</Button>}
              <Button variant="outline" onClick={() => setConfirmPair(null)}>
                Keep editing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          Upload your front and back artwork as PDFs. The technical spec: a print-ready PDF at A6 with 3mm bleed,
          300gsm, {TARGET_PX.w} × {TARGET_PX.h} pixels at 300 DPI. The front fills the whole card; the back design
          sits on the left half, with the address on the right.
        </p>
      </div>

      {/* Front / Back tab toggle */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['front', 'back'] as const).map((side) => {
          const saved = side === 'front' ? frontDesignUrl : backDesignUrl
          return (
            <button
              key={side}
              type="button"
              onClick={() => setActiveSide(side)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeSide === side ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {SIDE_CONFIG[side].label}
              <span
                className={`h-1.5 w-1.5 rounded-full ${saved ? 'bg-green-500' : 'bg-slate-300'}`}
                title={saved ? 'Design saved' : 'No design yet'}
              />
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Current saved design preview */}
        {currentDesignUrl && (
          <Card>
            <CardHeader>
              <CardTitle>{config.label} Design</CardTitle>
              <CardDescription>
                Red dashed line is the cut; anything outside it is trimmed off.
                {!isFront && ' The right half is where the address is printed.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="relative mx-auto overflow-hidden rounded-md border border-slate-200 bg-white"
                style={{ aspectRatio: `${DOC_W}/${DOC_H}`, maxWidth: 460 }}
              >
                {isPdfUrl(currentDesignUrl) ? (
                  <iframe src={`${currentDesignUrl}#toolbar=0&view=Fit`} className="h-full w-full" title={`${config.label} design`} />
                ) : (
                  <img src={currentDesignUrl} alt={`Current postcard ${activeSide} design`} className="h-full w-full object-cover" />
                )}
                {!isPdfUrl(currentDesignUrl) && (
                  <>
                    <GuideBox insets={guideInsets('full', false).cut} variant="cut" />
                    {!isFront && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 left-1/2 flex items-center justify-center border-l border-dashed border-amber-400 bg-amber-50/25">
                        <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-center text-[8px] font-medium uppercase leading-tight tracking-wide text-white">
                          Address &amp; postage
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={loading}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove {config.label.toLowerCase()} design
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload / edit card */}
        <Card>
          <CardHeader>
            <CardTitle>{currentDesignUrl ? `Replace ${config.label} Design` : `Upload ${config.label} Design`}</CardTitle>
            <CardDescription>
              {isFront
                ? 'The front is your full design, edge to edge.'
                : 'Your back design sits on the left half. The right half is reserved for the address and postage.'}
            </CardDescription>
            <p className="mt-1 inline-flex w-fit rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              Design at: {sizeHint}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={frontFileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
            <input ref={backFileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

            {!imageSrc && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={rendering}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 p-10 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 disabled:opacity-50"
              >
                {rendering ? (
                  <>
                    <ImageIcon className="h-8 w-8 animate-pulse" />
                    <span className="text-sm">Rendering PDF...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8" />
                    <span className="text-sm font-medium">Click to upload PDF</span>
                    <span className="text-xs">Crop, resize and bleed controls appear right here</span>
                  </>
                )}
              </button>
            )}

            {imageSrc && (
              <>
                {passthrough ? (
                  /* Lossless: show the rendered page with guides, no crop. */
                  <div
                    className="relative mx-auto w-full overflow-hidden rounded-md border border-slate-200 bg-white"
                    style={{ aspectRatio: `${ASPECT.fullBleed}`, maxWidth: 560 }}
                  >
                    <img src={imageSrc} alt="Print-ready artwork" className="h-full w-full object-contain" />
                    <GuideBox insets={guideInsets('full', false).cut} variant="cut" />
                    <GuideBox insets={guideInsets('full', false).safe} variant="safe" />
                    {!isFront && (
                      <div className="pointer-events-none absolute inset-y-0 left-1/2 right-0 border-l border-dashed border-amber-400 bg-amber-50/20" />
                    )}
                  </div>
                ) : isFront ? (
                  /* Front — crop the whole card. */
                  <div
                    className="relative mx-auto w-full overflow-hidden rounded-md border border-slate-200"
                    style={{ aspectRatio: `${cropAspect}`, maxWidth: 560 }}
                  >
                    <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={cropAspect} objectFit="cover"
                      onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                    <Guides kind="full" addBleed={addBleed} />
                  </div>
                ) : (
                  /* Back — crop into the LEFT half; the address half sits beside it. */
                  <div className="w-full">
                    <div
                      className="mx-auto flex overflow-hidden rounded-md border border-slate-200 bg-white"
                      style={{ aspectRatio: `${backContainerAspect}`, maxWidth: 560 }}
                    >
                      <div className="relative w-1/2">
                        <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={cropAspect} objectFit="cover"
                          onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                        <Guides kind="back" addBleed={addBleed} />
                      </div>
                      <AddressHalf />
                    </div>
                    <p className="mt-2 text-center text-xs text-slate-500">
                      Drag and zoom to frame your design in the left half.
                    </p>
                  </div>
                )}

                {/* Wrong-orientation hint */}
                {wrongShape && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Your file looks {uploadPortrait ? 'portrait' : 'landscape'}, but the {activeSide}{' '}
                    {isFront ? 'is landscape (wider than tall)' : 'design half is portrait (taller than wide)'}. It&apos;ll
                    be cropped to fit — for a clean result, upload artwork sized {sizeHint.split(' · ')[1]}.
                  </div>
                )}

                {/* Lossless passthrough toggle */}
                <label className="flex items-start gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3 text-sm">
                  <input type="checkbox" checked={passthrough} onChange={(e) => setPassthrough(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-indigo-900">
                      <Sparkles className="h-3.5 w-3.5" /> Send my PDF as-is — maximum quality
                    </span>
                    <span className="mt-0.5 block text-xs text-indigo-700/80">
                      Skips cropping and rasterising — your vector PDF prints straight through, zero quality loss.{' '}
                      {isFront
                        ? 'Use when your file is already a full A6 card, 154×111mm with 3mm bleed.'
                        : 'Use when your file is already a full A6 back (154×111mm, 3mm bleed) with the right half kept clear for the address.'}
                    </span>
                  </span>
                </label>

                {!passthrough && (
                  <>
                    {/* Add-bleed helper */}
                    <label className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm">
                      <input type="checkbox" checked={addBleed} onChange={(e) => setAddBleed(e.target.checked)} className="mt-0.5 h-4 w-4" />
                      <span>
                        <span className="font-medium text-slate-700">My design doesn&apos;t include bleed — add it for me</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Tick this if your artwork is exactly the finished size with no bleed. We&apos;ll extend the
                          edges by 3mm so no white shows after trimming.
                        </span>
                      </span>
                    </label>

                    <p className="text-xs text-slate-500">
                      {addBleed
                        ? 'Blue line is the safe zone — keep text and logos inside it.'
                        : 'Red line is the cut. Let the background run to the outer edge; keep text inside the blue safe line.'}
                    </p>

                    {lowRes && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        This crop is about {effectiveDpi} DPI, below the {MIN_PRINT_DPI} DPI we print at — it may
                        look soft. Zoom out, or upload a higher-resolution PDF.
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <span className="w-10 text-xs text-slate-500">Zoom</span>
                      <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Design'}</Button>
                  <Button variant="outline" onClick={cancelEdit} disabled={loading}>Cancel</Button>
                  <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={loading}>Choose different file</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exact print proof */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Exact printed postcard
          </CardTitle>
          <CardDescription>
            The real print-ready PDF, rendered from both sides of your card with a sample address. Nothing is
            printed, posted or charged — this is exactly what lands on the doormat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handlePreview} disabled={previewLoading || !bothSaved}>
              {previewLoading ? 'Rendering…' : 'Preview exact printed postcard'}
            </Button>
            {!bothSaved && <span className="text-xs text-slate-500">Save a front and a back design to render the proof.</span>}
          </div>
          {previewUrl && (
            <div className="space-y-2">
              <iframe src={previewUrl} className="h-[34rem] w-full rounded-md border border-slate-200" title="Postcard print proof" />
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                Open the proof PDF in a new tab
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="border-slate-100 bg-slate-50">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-600">
            <strong>Tip:</strong> Design at 300 DPI with 3mm bleed. The front is a full landscape card
            ({TARGET_PX.w}×{TARGET_PX.h}px); the back design is portrait and goes on the left half
            ({HALF_PX_W}×{TARGET_PX.h}px) — keep text {CARD.safe}mm inside the cut. Only the first page of the PDF is used.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
