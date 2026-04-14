'use client'

import { useState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'

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
    if (clean.length <= 3) return clean
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
        setError(data.error ?? 'Failed to add address')
      } else {
        onAdded()
        handleClose()
      }
    } catch {
      setError('Failed to add address')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">Add Custom Address</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 10 Downing Street, London"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(formatPostcode(e.target.value))}
              placeholder="e.g. SW1A 1AA"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-slate-50 rounded-b-xl">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!canSubmit || adding}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add to Leads
          </button>
        </div>
      </div>
    </div>
  )
}
