'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, Trash2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// A5 landscape aspect ratio (full card)
const A5_ASPECT = 210 / 148
// The back's right half is reserved by PostGrid for the address + postage, so
// users only design the left half (105 x 148mm).
const BACK_DESIGN_ASPECT = 105 / 148

type Side = 'front' | 'back'

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

async function getCroppedImg(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = cropArea.width
  canvas.height = cropArea.height
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create blob'))
    }, 'image/png')
  })
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

  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)

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
  const cropAspect = isFront ? A5_ASPECT : BACK_DESIGN_ASPECT

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

      // Render at ~300 DPI so the print is sharp. pdf.js scale 1 ≈ 72 DPI, so
      // 300 DPI needs scale ≈ 4.17. At 2x (≈144 DPI) the printer had to upscale,
      // which is why the trial postcards came out blurry. Cap the long edge so an
      // oversized PDF doesn't blow up the canvas/upload.
      const base = page.getViewport({ scale: 1 })
      const MAX_EDGE = 3000
      let scale = 300 / 72
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
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)

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
      toast.success(`${config.label} design saved`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save design')
    } finally {
      setLoading(false)
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Postcard Design</h1>
        <p className="text-sm text-slate-500">
          Upload your custom postcard designs as PDFs. They will be printed A5 (210x148mm).
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

      {/* Current design preview */}
      {currentDesignUrl && !imageSrc && (
        <Card>
          <CardHeader>
            <CardTitle>Current {config.label} Design</CardTitle>
            <CardDescription>This design is used when dispatching postcards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isFront ? (
              <div className="overflow-hidden rounded-md border border-slate-200" style={{ aspectRatio: '210/148', maxWidth: 420 }}>
                <img src={currentDesignUrl} alt="Current postcard front design" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="flex overflow-hidden rounded-md border border-slate-200 bg-white" style={{ aspectRatio: '210/148', maxWidth: 420 }}>
                <img src={currentDesignUrl} alt="Current postcard back design" className="w-1/2 h-full object-cover" />
                <AddressHalf />
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
              ? 'Upload a PDF, then crop and scale it to fill the A5 frame, then save.'
              : 'Upload a PDF, then crop and scale it to fill the left (design) half. The right half is reserved for the address and postage.'}
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
                  <span className="text-xs">First page will be used as the {activeSide} design</span>
                </>
              )}
            </button>
          )}

          {imageSrc && (
            <>
              {isFront ? (
                /* Front — crop the whole card */
                <div className="relative w-full overflow-hidden rounded-md border border-slate-200" style={{ height: 480 }}>
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={A5_ASPECT}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
              ) : (
                /* Back — only the left half is yours; the right half is the
                   address area, shown so it's clear where your design can go. */
                <div className="w-full">
                  <div
                    className="mx-auto flex overflow-hidden rounded-md border border-slate-200 bg-white"
                    style={{ aspectRatio: '210 / 148', maxWidth: 560 }}
                  >
                    <div className="relative w-1/2">
                      <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={BACK_DESIGN_ASPECT}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    </div>
                    <AddressHalf />
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Your design fills the left half. The right half is reserved for the address and postage.
                  </p>
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

      {/* Info card */}
      <Card className="border-slate-100 bg-slate-50">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-600">
            <strong>Tip:</strong> For the sharpest print, design at 300 DPI –{' '}
            {isFront ? 'A5 (210×148mm) for the front' : 'the left half (105×148mm) for the back'}. Only the first page of the PDF is used.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
