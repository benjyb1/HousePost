'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  onAdded: () => void
}

export default function AddAddressModal({ open, onClose, onAdded }: Props) {
  const [postcode, setPostcode] = useState('')
  const [address, setAddress] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function formatPostcode(raw: string): string {
    const clean = raw.replace(/\s/g, '').toUpperCase()
    // Only insert the inward-code space once the entry is long enough to be a
    // real postcode (UK postcodes are 5–7 chars). Formatting half-typed input on
    // every keystroke fights the caret and mangles short entries like "N167".
    if (clean.length < 5) return clean
    return clean.slice(0, -3) + ' ' + clean.slice(-3)
  }

  async function handleAdd() {
    if (!address.trim() || !postcode.trim()) return
    setAdding(true)
    setError(null)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressLine: address.trim(), postcode: postcode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not add that address. Please try again.')
      } else {
        onAdded()
        handleClose()
      }
    } catch {
      setError('Could not add that address. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  function handleClose() {
    setPostcode('')
    setAddress('')
    setError(null)
    onClose()
  }

  const canSubmit = address.trim() && postcode.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-address-title"
        className="w-full max-w-md rounded-lg border border-line bg-paper-hi text-ink shadow-[0_16px_36px_-18px_rgba(40,30,15,0.4)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line py-3 pl-5 pr-3">
          <h2 id="add-address-title" className="text-lg font-semibold leading-snug">
            Add an address
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="grid size-10 shrink-0 place-items-center rounded-[3px] text-ink-2 transition-colors hover:bg-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <label htmlFor="add-address-line" className="block text-[13.5px] text-ink-2">
              Address
            </label>
            <input
              id="add-address-line"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 14 Croft Road, Godalming"
              autoComplete="off"
              className="h-10 w-full rounded-md border border-line-2 bg-paper-hi px-3 text-[15px] font-medium text-ink placeholder:font-normal placeholder:text-ink-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-navy"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-address-postcode" className="block text-[13.5px] text-ink-2">
              Postcode
            </label>
            <input
              id="add-address-postcode"
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(formatPostcode(e.target.value))}
              placeholder="e.g. GU7 1BE"
              autoComplete="off"
              className="h-10 w-full rounded-md border border-line-2 bg-paper-hi px-3 text-[15px] font-medium text-ink placeholder:font-normal placeholder:text-ink-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-navy sm:max-w-[200px]"
            />
          </div>

          {error && (
            <p role="alert" className="text-[14px] text-[#8a3324]">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 rounded-b-lg border-t border-line bg-paper px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canSubmit || adding}>
            {adding && <Loader2 size={16} className="animate-spin" />}
            Add to your list
          </Button>
        </div>
      </div>
    </div>
  )
}
