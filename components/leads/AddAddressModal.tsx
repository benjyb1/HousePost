'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  const addressRef = useRef<HTMLInputElement>(null)

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

  // No closing (X, Escape, a click outside) while the address is being added.
  const holdWhileAdding = (event: Event) => {
    if (adding) event.preventDefault()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !adding) handleClose()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        onEscapeKeyDown={holdWhileAdding}
        onInteractOutside={holdWhileAdding}
        onOpenAutoFocus={(event) => {
          // Start in the address field rather than on the close button.
          event.preventDefault()
          addressRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Add an address</DialogTitle>
          <DialogCloseButton disabled={adding} />
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <label htmlFor="add-address-line" className="block text-[13.5px] text-ink-2">
              Address
            </label>
            <input
              ref={addressRef}
              id="add-address-line"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 14 Croft Road, Godalming"
              autoComplete="off"
              className="h-10 w-full rounded-md border border-line-2 bg-paper-hi px-3 text-base font-medium text-ink placeholder:font-normal placeholder:text-ink-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-navy md:text-[15px]"
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
              className="h-10 w-full rounded-md border border-line-2 bg-paper-hi px-3 text-base font-medium text-ink placeholder:font-normal placeholder:text-ink-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-navy sm:max-w-[200px] md:text-[15px]"
            />
          </div>

          {error && (
            <p role="alert" className="text-[14px] text-[#8a3324]">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canSubmit || adding}>
            {adding && <Loader2 size={16} className="animate-spin" />}
            Add to your list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
