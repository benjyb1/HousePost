'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, Trash2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// PostGrid prints a 6x4" card. The artwork is NOT rendered at the 6x4 trim
// size — PostGrid renders the HTML to the full bleed area (6.25x4.25") and then
// cuts 0.125" off every edge down to 6x4". So the design has to extend past the
// trim on all sides; whatever sits in that outer 0.125" band gets trimmed away.
const CARD = { trimW: 6, trimH: 4, bleed: 0.125 } // inches
const DOC_W = CARD.trimW + CARD.bleed * 2 // 6.25"
const DOC_H = CARD.trimH + CARD.bleed * 2 // 4.25"
// The front fills the whole bleed area.
const FRONT_ASPECT = DOC_W / DOC_H // 6.25 / 4.25
// The back's right half is reserved by PostGrid for the address + postage, so
// the design covers the left half of the finished card (3") plus bleed on the
// three OUTER edges only. The right edge is the card centre, so it gets no
// bleed — hence 3.125 (3" + one 0.125" bleed) x 4.25" (4" + two bleeds).
const BACK_DESIGN_W = CARD.trimW / 2 + CARD.bleed // 3.125"
const BACK_DESIGN_ASPECT = BACK_DESIGN_W / DOC_H // 3.125 / 4.25
// Trim line as a fraction of the full bleed doc, for the print-preview overlay.
const TRIM_INSET_X = (CARD.bleed / DOC_W) * 100 // 2%
const TRIM_INSET_Y = (CARD.bleed / DOC_H) * 100 // ~2.94%

// When the user lets us add the bleed for them, the crop frame is the FINISHED
// card (no bleed) and we synthesise the 0.125" margin afterwards. These are the
// trim aspect ratios for that mode.
const FRONT_TRIM_ASPECT = CARD.trimW / CARD.trimH // 6 / 4
const BACK_TRIM_ASPECT = CARD.trimW / 2 / CARD.trimH // 3 / 4

type Side = 'front' | 'back'

// Below ~250 DPI a 6x4 card starts to look soft, so warn the customer before
// they commit a design that'll print blurry.
const MIN_PRINT_DPI = 250

/**
 * Where the guide line sits inside the crop frame, as % insets per edge.
 * - "addBleed" off: the frame is the full bleed doc, so the guide is the TRIM
 *   line, one bleed in from every cut edge.
 * - "addBleed" on: the frame is the finished card, so the guide is the SAFE
 *   zone, one bleed inside the cut.
 * The back's right edge is the card centre (not a cut), so it never gets an inset.
 */
function guideInsets(side: Side, addBleed: boolean) {
  const frameW = addBleed
    ? side === 'front' ? CARD.trimW : CARD.trimW / 2
    : side === 'front' ? DOC_W : BACK_DESIGN_W
  const frameH = addBleed ? CARD.trimH : DOC_H
  const x = (CARD.bleed / frameW) * 100
  const y = (CARD.bleed / frameH) * 100
  return {
    left: x,
    right: side === 'back' ? 0 : x,
    top: y,
    bottom: y,
    variant: addBleed ? ('safe' as const) : ('cut' as const),
  }
}

/**
 * Dashed guide drawn over the live cropper. A red "cut" line shows what gets
 * trimmed off; a blue "safe" line (matching PostGrid's own template) shows where
 * to keep text. Insets are given per edge so the back's centre edge stays flush.
 */
function GuideBox({
  left,
  right,
  top,
  bottom,
  variant,
}: ReturnType<typeof guideInsets>) {
  const cut = variant === 'cut'
  return (
    <div
      className="pointer-events-none absolute rounded-[1px] border border-dashed"
      style={{
        left: `${left}%`,
        right: `${right}%`,
        top: `${top}%`,
        bottom: `${bottom}%`,
        borderColor: cut ? 'rgba(239,68,68,0.95)' : 'rgba(37,99,235,0.95)',
        ...(cut ? { boxShadow: '0 0 0 9999px rgba(15,23,42,0.22)' } : {}),
      }}
    />
  )
}

/**
 * The address half of the postcard back, shown next to the crop area so users
 * can see this space is taken — PostGrid prints the real recipient address and
 * postage here, so their design only goes on the other (left) half.
 */
function AddressHalf() {
  return (
    <div className="flex h-full w-1/2 flex-col justify-between border-l border-dashed border-slate-300 bg-slate-50 p-3">
      <div className="flex justify-end">
        <div className="flex h-9 w-7 items-center justify-center rounded-sm border-2 border-dashed border-slate-300 text-[7px] font-medium text-slate-400">
          STAMP
        </div>
      </div>
      <div className="space-y-0.5 text-[10px] leading-tight text-slate-400">
        <p>Mr A. Homeowner</p>
        <p>1 Example Street</p>
        <p>Sometown</p>
        <p>AB12 3CD</p>
      </div>
      <p className="text-[8px] uppercase tracking-wide text-slate-400">
        Address area · added automatically
      </p>
    </div>
  )
}

/**
 * Dashed rectangle marking where PostGrid cuts the card down to 6x4". Anything
 * outside it is bleed and gets trimmed off. Sits over a full-bleed preview so a
 * customer can see exactly what survives the cut — the same thing the printer's
 * crop marks indicate on the proof.
 */
function TrimGuide() {
  return (
    <div
      className="pointer-events-none absolute rounded-[1px] border border-dashed border-red-500/90"
      style={{
        top: `${TRIM_INSET_Y}%`,
        bottom: `${TRIM_INSET_Y}%`,
        left: `${TRIM_INSET_X}%`,
        right: `${TRIM_INSET_X}%`,
        boxShadow: '0 0 0 9999px rgba(15,23,42,0.18)',
      }}
    />
  )
}

const SIDE_CONFIG = {
  front: {
    storagePath: (userId: string) => `${userId}/design.png`,
    settingsKey: 'postcard_design_url',
    label: 'Front',
  },
  back: {
    storagePath: (userId: string) => `${userId}/design-back.png`,
    settingsKey: 'postcard_design_back_url',
    label: 'Back',
  },
} as const

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create blob'))
    }, 'image/png')
  })
}

/**
 * Crop the rendered design to the chosen area and return a PNG.
 *
 * When `addBleed` is set, the crop area is the FINISHED 6x4 card (or the 3x4
 * back half) and we synthesise the 0.125" bleed by replicating the edge pixels
 * outward — for customers who upload artwork without bleed. The bleed band gets
 * trimmed off, so the stretched edge never shows on the final card; it just
 * stops a white sliver appearing if the cut drifts. The back gets no right-edge
 * bleed because that edge is the card centre.
 */
async function getCroppedImg(
  imageSrc: string,
  cropArea: Area,
  addBleed?: Side
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })

  const cw = Math.round(cropArea.width)
  const ch = Math.round(cropArea.height)

  if (!addBleed) {
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cw, ch)
    return canvasToBlob(canvas)
  }

  // Bleed in pixels, scaled from the cropped trim region.
  const bx = Math.max(1, Math.round((cw * CARD.bleed) / CARD.trimW))
  const by = Math.max(1, Math.round((ch * CARD.bleed) / CARD.trimH))
  const rightBleed = addBleed === 'back' ? 0 : bx // back right edge is the card centre

  const canvas = document.createElement('canvas')
  canvas.width = cw + bx + rightBleed
  canvas.height = ch + by * 2
  const ctx = canvas.getContext('2d')!

  // Finished artwork in the middle, offset by the left/top bleed.
  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, bx, by, cw, ch)

  // Replicate the outer rows/columns of the artwork into each margin.
  ctx.drawImage(canvas, bx, by, 1, ch, 0, by, bx, ch) // left
  ctx.drawImage(canvas, bx, by, cw, 1, bx, 0, cw, by) // top
  ctx.drawImage(canvas, bx, by + ch - 1, cw, 1, bx, by + ch, cw, by) // bottom
  ctx.drawImage(canvas, bx, by, 1, 1, 0, 0, bx, by) // top-left corner
  ctx.drawImage(canvas, bx, by + ch - 1, 1, 1, 0, by + ch, bx, by) // bottom-left corner
  if (rightBleed) {
    ctx.drawImage(canvas, bx + cw - 1, by, 1, ch, bx + cw, by, rightBleed, ch) // right
    ctx.drawImage(canvas, bx + cw - 1, by, 1, 1, bx + cw, 0, rightBleed, by) // top-right
    ctx.drawImage(canvas, bx + cw - 1, by + ch - 1, 1, 1, bx + cw, by + ch, rightBleed, by) // bottom-right
  }

  return canvasToBlob(canvas)
}

export default function PostcardDesignPage() {
  const supabase = createClient()
  const frontFileInputRef = useRef<HTMLInputElement>(null)
  const backFileInputRef = useRef<HTMLInputElement>(null)

  const [activeSide, setActiveSide] = useState<Side>('front')
  const [userId, setUserId] = useState<string | null>(null)

  // Front side state
  const [frontDesignUrl, setFrontDesignUrl] = useState<string | null>(null)
  const [frontImageSrc, setFrontImageSrc] = useState<string | null>(null)
  const [frontCrop, setFrontCrop] = useState({ x: 0, y: 0 })
  const [frontZoom, setFrontZoom] = useState(1)
  const [frontCroppedAreaPixels, setFrontCroppedAreaPixels] = useState<Area | null>(null)

  // Back side state
  const [backDesignUrl, setBackDesignUrl] = useState<string | null>(null)
  const [backImageSrc, setBackImageSrc] = useState<string | null>(null)
  const [backCrop, setBackCrop] = useState({ x: 0, y: 0 })
  const [backZoom, setBackZoom] = useState(1)
  const [backCroppedAreaPixels, setBackCroppedAreaPixels] = useState<Area | null>(null)

  // Whether to synthesise bleed for the customer, per side (some uploads include
  // bleed, some don't — they're designed in separate steps).
  const [frontAddBleed, setFrontAddBleed] = useState(false)
  const [backAddBleed, setBackAddBleed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)

  // Exact-print proof (PostGrid test-mode render)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
  const fileInputRef = isFront ? frontFileInputRef : backFileInputRef
  const config = SIDE_CONFIG[activeSide]
  const addBleed = isFront ? frontAddBleed : backAddBleed
  const setAddBleed = isFront ? setFrontAddBleed : setBackAddBleed

  // Crop frame: the bleed doc when the design already has bleed, or the finished
  // card when we're adding it.
  const cropAspect = isFront
    ? addBleed ? FRONT_TRIM_ASPECT : FRONT_ASPECT
    : addBleed ? BACK_TRIM_ASPECT : BACK_DESIGN_ASPECT

  // Roughly how many DPI the cropped artwork will print at. The crop frame spans
  // this many inches across, so dividing the cropped pixel width by it gives DPI.
  const cropFrameInches = isFront
    ? addBleed ? CARD.trimW : DOC_W
    : addBleed ? CARD.trimW / 2 : BACK_DESIGN_W
  const effectiveDpi = croppedAreaPixels
    ? Math.round(croppedAreaPixels.width / cropFrameInches)
    : null
  const lowRes = effectiveDpi != null && effectiveDpi < MIN_PRINT_DPI

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const res = await fetch('/api/settings')
      const { profile } = await res.json()
      setFrontDesignUrl(profile?.postcard_design_url ?? null)
      setBackDesignUrl(profile?.postcard_design_back_url ?? null)
    }
    load()
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

    setRendering(true)
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const page = await pdf.getPage(1)

      // Render at ~400 DPI so the print is sharp with headroom above PostGrid's
      // 300 DPI. pdf.js scale 1 ≈ 72 DPI, so 400 DPI needs scale ≈ 5.56. (At 2x
      // ≈144 DPI the printer had to upscale, which is why the trial postcards came
      // out blurry.) Cap the long edge so an oversized PDF doesn't blow up the
      // canvas/upload — 6.25" at 400 DPI is 2500px, well under the cap.
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
      setImageSrc(canvas.toDataURL('image/png'))
    } catch {
      toast.error('Failed to render PDF – make sure it is a valid PDF file')
    } finally {
      setRendering(false)
      // Reset the input so the same file can be re-selected
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels || !userId) return
    setLoading(true)

    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, addBleed ? activeSide : undefined)

      const path = config.storagePath(userId)
      const { error: uploadError } = await supabase.storage
        .from('postcard-designs')
        .upload(path, blob, { upsert: true, contentType: 'image/png' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('postcard-designs')
        .getPublicUrl(path)

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.settingsKey]: publicUrl }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to save')
      }

      setCurrentDesignUrl(publicUrl)
      setImageSrc(null)
      setPreviewUrl(null) // design changed — the old proof is stale
      toast.success(`${config.label} design saved`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save design')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Render an exact print proof through PostGrid's test sandbox. Nothing is
   * printed, posted or charged — it returns the same PDF the printer would use.
   */
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
        .remove([config.storagePath(userId)])

      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.settingsKey]: null }),
      })

      setCurrentDesignUrl(null)
      setImageSrc(null)
      toast.success(`${config.label} design removed`)
    } catch {
      toast.error('Failed to remove design')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Postcard Design</h1>
        <p className="text-sm text-slate-500">
          Upload your custom postcard designs as PDFs. They&apos;re printed 6×4″ (152×102mm). Design at 6.25×4.25″ so there&apos;s 0.125″ of bleed to trim.
        </p>
      </div>

      {/* Front / Back tab toggle */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['front', 'back'] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setActiveSide(side)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeSide === side
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {SIDE_CONFIG[side].label}
          </button>
        ))}
      </div>

      {/* Exact print proof — kept at the top so the button is visible without
          scrolling */}
      {(frontDesignUrl || backDesignUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>Print preview</CardTitle>
            <CardDescription>Generate a preview of what will be printed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handlePreview} disabled={previewLoading}>
              {previewLoading ? 'Rendering proof…' : 'Preview exact printed postcard'}
            </Button>
            {previewUrl && (
              <div className="space-y-2">
                <iframe
                  src={previewUrl}
                  className="h-[34rem] w-full rounded-md border border-slate-200"
                  title="Postcard print proof"
                />
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  Open the proof PDF in a new tab
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Design preview (left) and upload / crop tools (right), side by side so
          the page fills the width instead of a narrow column */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
      {/* Current design preview */}
      {currentDesignUrl && (
        <Card>
          <CardHeader>
            <CardTitle>{config.label} Design</CardTitle>
            <CardDescription>
              The dashed red line marks where it&apos;ll be cropped, anything
              outside it is trimmed off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isFront ? (
              <div className="relative overflow-hidden rounded-md border border-slate-200" style={{ aspectRatio: `${DOC_W}/${DOC_H}`, maxWidth: 420 }}>
                <img src={currentDesignUrl} alt="Current postcard front design" className="w-full h-full object-cover" />
                <TrimGuide />
              </div>
            ) : (
              <div className="relative flex overflow-hidden rounded-md border border-slate-200 bg-white" style={{ aspectRatio: `${DOC_W}/${DOC_H}`, maxWidth: 420 }}>
                <img src={currentDesignUrl} alt="Current postcard back design" className="w-1/2 h-full object-cover" />
                <AddressHalf />
                <TrimGuide />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={loading}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove design
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload card */}
      <Card>
        <CardHeader>
          <CardTitle>{currentDesignUrl ? `Replace ${config.label} Design` : `Upload ${config.label} Design`}</CardTitle>
          <CardDescription>
            {isFront
              ? 'Upload a PDF. If it already has 0.125″ bleed (6.25×4.25″), crop to fill the frame. If it\'s just the finished 6×4″ card, tick “add bleed for me” below and crop to the card.'
              : 'Upload a PDF for the left (design) half. The right half is reserved for the address and postage. No bleed on your file? Tick “add bleed for me”.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Separate hidden file inputs per side so they don't interfere */}
          <input
            ref={frontFileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={backFileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

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
                  <span className="text-xs">Then crop &amp; resize it to fit — controls appear right here</span>
                </>
              )}
            </button>
          )}

          {imageSrc && (
            <>
              {isFront ? (
                /* Front — crop the whole card. The guide overlay shows the cut. */
                <div
                  className="relative mx-auto w-full overflow-hidden rounded-md border border-slate-200"
                  style={{ aspectRatio: `${cropAspect}`, maxWidth: 560 }}
                >
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={cropAspect}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                  <GuideBox {...guideInsets('front', addBleed)} />
                </div>
              ) : (
                /* Back — only the left half is yours; the right half is the
                   address area, shown so it's clear where your design can go. */
                <div className="w-full">
                  <div
                    className="mx-auto flex overflow-hidden rounded-md border border-slate-200 bg-white"
                    style={{ aspectRatio: `${addBleed ? CARD.trimW / CARD.trimH : DOC_W / DOC_H}`, maxWidth: 560 }}
                  >
                    <div className="relative w-1/2">
                      <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={cropAspect}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                      <GuideBox {...guideInsets('back', addBleed)} />
                    </div>
                    <AddressHalf />
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Your design fills the left half. The right half is reserved for the address and postage.
                  </p>
                </div>
              )}

              {/* Add-bleed helper — for designs that don't already include bleed */}
              <label className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={addBleed}
                  onChange={(e) => setAddBleed(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="font-medium text-slate-700">My design doesn&apos;t include bleed — add it for me</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Tick this if your artwork is exactly the finished postcard size.
                    We&apos;ll extend the edges by 0.125″ so no white shows after
                    trimming. Leave it unticked if you already designed at 6.25×4.25″
                    with bleed.
                  </span>
                </span>
              </label>

              {/* Guide legend */}
              <p className="text-xs text-slate-500">
                {addBleed
                  ? 'The blue dashed line is the safe zone — keep text and logos inside it.'
                  : 'The red dashed line is where the card is cut. Let the background run to the outer edge, and keep text inside the line.'}
              </p>

              {/* Low-resolution warning */}
              {lowRes && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  This crop is about {effectiveDpi} DPI, below the {MIN_PRINT_DPI} DPI
                  we recommend — it may print soft. Zoom out, or upload a
                  higher-resolution PDF.
                </div>
              )}

              {/* Zoom slider */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-10">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Design'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImageSrc(null)
                    setCrop({ x: 0, y: 0 })
                    setZoom(1)
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  Choose different file
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Info card */}
      <Card className="border-slate-100 bg-slate-50">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-600">
            <strong>Tip:</strong> For the sharpest print, design at 300 DPI{' '}
            {isFront
              ? 'with the front at 6.25×4.25″ (1875×1275px), and 0.125″ of bleed on every edge'
              : 'with the back design half at 3.125×4.25″ (937×1275px), and 0.125″ of bleed on the top, bottom and left only (none on the right, that edge is the card centre)'}
            . Keep important text and logos at least 0.125″ inside the red trim line. Only the first page of the PDF is used.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
