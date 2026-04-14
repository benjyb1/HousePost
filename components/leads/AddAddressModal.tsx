'use client'

import { useState } from 'react'
import { X, Search, Plus, Loader2 } from 'lucide-react'

interface AddressResult {
  addressLine: string
  postcode: string
}

interface Props {
  open: boolean
  onClose: () => void
  onAdded: () => void
}

export default function AddAddressModal({ open, onClose, onAdded }: Props) {
  const [postcode, setPostcode] = useState('')
  const [addresses, setAddresses] = useState<AddressResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualAddress, setManualAddress] = useState('')

  if (!open) return null

  function formatPostcode(raw: string): string {
    const clean = raw.replace(/\s/g, '').toUpperCase()
    if (clean.length <= 3) return clean
    return clean.slice(0, -3) + ' ' + clean.slice(-3)
  }

  function handlePostcodeChange(value: string) {
    setPostcode(formatPostcode(value))
  }

  async function handleLookup() {
    if (!postcode.trim()) return
    setLoading(true)
    setError(null)
    setAddresses([])
    setSelectedAddress(null)
    setManualMode(false)

    try {
      const res = await fetch(`/api/address-lookup?postcode=${encodeURIComponent(postcode)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Lookup failed')
        setManualMode(true)
      } else if (data.addresses.length === 0) {
        setError('No addresses found for this postcode. Enter manually below.')
        setManualMode(true)
      } else {
        setAddresses(data.addresses)
      }
    } catch {
      setError('Failed to look up postcode. Enter manually below.')
      setManualMode(true)
    } finally {
      setLoading(false)
    }
  }

  function getAddressToSubmit(): { addressLine: string; postcode: string } | null {
    if (selectedAddress) return selectedAddress
    if (manualMode && manualAddress.trim() && postcode.trim()) {
      return { addressLine: manualAddress.trim(), postcode: postcode.trim() }
    }
    return null
  }

  async function handleAdd() {
    const addr = getAddressToSubmit()
    if (!addr) return
    setAdding(true)
    setError(null)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addr),
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
    setAddresses([])
    setSelectedAddress(null)
    setManualMode(false)
    setManualAddress('')
    setError(null)
    onClose()
  }

  const canSubmit = !!getAddressToSubmit()

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
            <label className="block text-sm font-medium text-slate-600 mb-1">Postcode</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={postcode}
                onChange={(e) => handlePostcodeChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="e.g. SW1A 1AA"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLookup}
                disabled={loading || !postcode.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Find
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {addresses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Select address</label>
              <select
                value={selectedAddress?.addressLine ?? ''}
                onChange={(e) => {
                  const addr = addresses.find((a) => a.addressLine === e.target.value)
                  setSelectedAddress(addr ?? null)
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose an address...</option>
                {addresses.map((addr, i) => (
                  <option key={i} value={addr.addressLine}>
                    {addr.addressLine}
                  </option>
                ))}
              </select>
              <button
                onClick={() => { setManualMode(true); setAddresses([]); setSelectedAddress(null) }}
                className="mt-1 text-xs text-blue-600 hover:underline"
              >
                Can't see your address? Enter manually
              </button>
            </div>
          )}

          {manualMode && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Address</label>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="e.g. 10 Downing Street, London"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
