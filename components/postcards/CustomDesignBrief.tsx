'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Sparkles, Upload, X, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Assets go straight from the browser into this PRIVATE bucket (per-user-folder
// RLS), never through our API: Vercel caps a function's request body at 4.5MB,
// which a brief with a couple of logos in it blew straight past.
const ASSET_BUCKET = 'design-request-assets'

const CUSTOM_DESIGN_FEE = '£75'
const MAX_FILES = 10
const MAX_FILE_MB = 15
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/svg+xml,application/pdf'

/**
 * "Request custom design (£75)" — the customer sends us their brand and a brief
 * and we design a professional postcard for them. This form describes the
 * service and benefit only; it never says HOW the design is produced.
 *
 * On submit the parent-visible outcome is: a one-off £75 charge to the saved
 * card, the brief + uploaded assets stored, and the team notified. A declined
 * card is surfaced here and nothing is recorded as a paid request.
 */
export function CustomDesignBrief() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [businessName, setBusinessName] = useState('')
  const [colourScheme, setColourScheme] = useState('')
  const [text, setText] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    const tooBig = incoming.find((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    if (tooBig) {
      toast.error(`“${tooBig.name}” is over ${MAX_FILE_MB}MB. Please upload a smaller file.`)
      return
    }
    setFiles((prev) => {
      const merged = [...prev, ...incoming]
      if (merged.length > MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files.`)
        return merged.slice(0, MAX_FILES)
      }
      return merged
    })
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim()) {
      toast.error('Please add your business name.')
      return
    }
    if (!notes.trim() && !text.trim() && files.length === 0) {
      toast.error('Add a few notes, some text, or an asset so our designer has something to work from.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Upload the assets directly to storage, into this user's own folder.
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in again and retry.')
      const uploadId = crypto.randomUUID()
      const assets: { path: string; name: string; type: string; size: number }[] = []
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file'
        const path = `${user.id}/design-requests/${uploadId}/${safe}`
        const { error: uploadError } = await supabase.storage
          .from(ASSET_BUCKET)
          .upload(path, f, { upsert: true, contentType: f.type })
        if (uploadError) throw new Error(`Could not upload “${f.name}”: ${uploadError.message}`)
        assets.push({ path, name: f.name, type: f.type, size: f.size })
      }

      // 2. Send the brief (with the asset paths) — the fee is charged here.
      const res = await fetch('/api/postcards/design-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          colourScheme: colourScheme.trim(),
          text: text.trim(),
          notes: notes.trim(),
          assets,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }
      setDone(true)
      toast.success(data.duplicate ? 'We already have this brief — no second charge was taken' : 'Design request received')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit your request')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card className="border-green-200 bg-green-50/60">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
          <h3 className="text-lg font-semibold text-slate-900">Your request is in</h3>
          <p className="max-w-md text-sm text-slate-600">
            Thanks — we&apos;ve received your brief and taken the {CUSTOM_DESIGN_FEE} design fee. Our team will get
            started and be in touch about your postcard. Once your design is ready it&apos;ll be added to your
            account, and you can send it just like any other postcard.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Service description — the benefit, not the how. */}
      <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-slate-700" />
            We&apos;ll design your postcard for you
          </CardTitle>
          <CardDescription className="text-slate-600">
            Prefer to leave it to us? For a one-off {CUSTOM_DESIGN_FEE} fee we&apos;ll create a polished,
            print-ready postcard built around your brand. Share your logo, colours and a few pointers below, and
            we&apos;ll handle the design so it looks professional and prints beautifully at A6. The finished card is
            added to your account ready to send.
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Your brief</CardTitle>
            <CardDescription>
              The more you share, the closer the first draft will be. Nothing here is set in stone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Bream & Co Interiors"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="colourScheme">Colours / brand style</Label>
              <Input
                id="colourScheme"
                value={colourScheme}
                onChange={(e) => setColourScheme(e.target.value)}
                placeholder="e.g. Navy and gold, modern and clean"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text">Text for the card</Label>
              <textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Headline, contact details, offer, call to action…"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Design pointers / notes</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Anything you love or want to avoid, examples you like, the feel you're after…"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            {/* Asset upload */}
            <div className="space-y-2">
              <Label>Assets (logo, photos, anything to include)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-6 text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm font-medium">Click to add files</span>
                <span className="text-xs">PNG, JPG, SVG or PDF · up to {MAX_FILES} files · {MAX_FILE_MB}MB each</span>
              </button>

              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-slate-700">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Submitting charges a one-off <strong>{CUSTOM_DESIGN_FEE}</strong> design fee to the card saved in
              Billing. You&apos;ll only be charged once your brief is submitted.
            </div>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Submitting…' : `Submit brief & pay ${CUSTOM_DESIGN_FEE}`}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
