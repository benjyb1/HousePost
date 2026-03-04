'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, Trash2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// A5 landscape aspect ratio
const A5_ASPECT = 210 / 148

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [currentDesignUrl, setCurrentDesignUrl] = useState<string | null>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const res = await fetch('/api/settings')
      const { profile } = await res.json()
      setCurrentDesignUrl(profile?.postcard_design_url ?? null)
    }
    load()
  }, [])

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

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

      // Render at 2x scale for good resolution
      const scale = 2
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvas, viewport }).promise
      setImageSrc(canvas.toDataURL('image/png'))
    } catch {
      toast.error('Failed to render PDF — make sure it is a valid PDF file')
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

      const path = `${userId}/design.png`
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
        body: JSON.stringify({ postcard_design_url: publicUrl }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to save')
      }

      setCurrentDesignUrl(publicUrl)
      setImageSrc(null)
      toast.success('Postcard design saved')
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
        .remove([`${userId}/design.png`])

      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcard_design_url: null }),
      })

      setCurrentDesignUrl(null)
      setImageSrc(null)
      toast.success('Design removed')
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
          Upload your custom postcard design as a PDF. It will be printed A5 (210×148mm).
        </p>
      </div>

      {/* Current design preview */}
      {currentDesignUrl && !imageSrc && (
        <Card>
          <CardHeader>
            <CardTitle>Current Design</CardTitle>
            <CardDescription>This design is used when dispatching postcards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-md border border-slate-200" style={{ aspectRatio: '210/148', maxWidth: 420 }}>
              <img src={currentDesignUrl} alt="Current postcard design" className="w-full h-full object-cover" />
            </div>
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
          <CardTitle>{currentDesignUrl ? 'Replace Design' : 'Upload Design'}</CardTitle>
          <CardDescription>
            Upload a PDF, crop and scale it to fit the A5 frame, then save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
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
                  <span className="text-sm">Rendering PDF…</span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8" />
                  <span className="text-sm font-medium">Click to upload PDF</span>
                  <span className="text-xs">First page will be used as the design</span>
                </>
              )}
            </button>
          )}

          {imageSrc && (
            <>
              {/* Crop tool — fixed height container required by react-easy-crop */}
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
                  {loading ? 'Saving…' : 'Save Design'}
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
            <strong>Tip:</strong> Design your postcard at exactly A5 (210×148mm) at 300 DPI for the sharpest print quality. Only the first page of the PDF is used.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
