'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, X, Check } from 'lucide-react'
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
      if (data.warning) toast.warning(data.warning, { duration: Infinity })
      else toast.success(data.duplicate ? 'We already have this brief. No second charge was taken.' : 'Design request received')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit your request')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Check className="h-5 w-5 text-navy" aria-hidden="true" />
            Your request is in
          </h3>
          <p className="max-w-[60ch] text-sm leading-relaxed text-ink-2">
            Thanks, we&apos;ve received your brief and taken the {CUSTOM_DESIGN_FEE} design fee. Our team will get
            started and be in touch about your postcard. Once your design is ready it&apos;ll be added to your
            account, and you can send it just like any other postcard.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* What the service is, in one plain paragraph. */}
      <p className="max-w-[68ch] text-[15px] leading-relaxed text-ink-2">
        For a one-off {CUSTOM_DESIGN_FEE} fee, our designer makes your postcard for you from your logo, colours
        and a few notes. The finished card is added to your account, ready to send.
      </p>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Your brief</CardTitle>
            <CardDescription>
              The more you share, the closer the first draft will be.
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
                className="w-full resize-y rounded-md border border-line-2 bg-paper-hi px-3 py-2 text-base font-medium text-ink outline-none placeholder:text-ink-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy md:text-[15px]"
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
                className="w-full resize-y rounded-md border border-line-2 bg-paper-hi px-3 py-2 text-base font-medium text-ink outline-none placeholder:text-ink-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy md:text-[15px]"
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
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-2 bg-paper p-6 text-ink-2 transition-colors hover:border-navy/50 hover:text-ink"
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
                      className="flex items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm"
                    >
                      <span className="truncate text-ink">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="shrink-0 rounded-[3px] p-1 text-ink-2 hover:bg-linen hover:text-ink"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-sm text-ink-2">
              Submitting charges a one-off <strong className="font-semibold text-ink">{CUSTOM_DESIGN_FEE}</strong> design
              fee to the card saved in Account.
            </p>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Submitting…' : `Submit brief & pay ${CUSTOM_DESIGN_FEE}`}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
