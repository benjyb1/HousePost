'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { PROPERTY_TYPE_LABELS } from '@/types/land-registry'

const ALL_TYPES = Object.entries(PROPERTY_TYPE_LABELS) as [string, string][]

interface Profile {
  full_name: string
  company_name: string | null
  office_postcode: string
  search_radius_miles: number
  min_price: number | null
  max_price: number | null
  property_types: string[]
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(({ profile }) => setProfile({
        ...profile,
        min_price: profile.min_price ? profile.min_price / 100 : null,
        max_price: profile.max_price ? profile.max_price / 100 : null,
      }))
  }, [])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: profile.full_name,
        company_name: profile.company_name,
        office_postcode: profile.office_postcode,
        search_radius_miles: profile.search_radius_miles,
        min_price: profile.min_price ? profile.min_price * 100 : null,
        max_price: profile.max_price ? profile.max_price * 100 : null,
        property_types: profile.property_types,
      }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to save')
    else toast.success('Preferences saved')
    setSaving(false)
  }

  function toggleType(type: string, checked: boolean) {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            property_types: checked
              ? [...prev.property_types, type]
              : prev.property_types.filter((t) => t !== type),
          }
        : prev
    )
  }

  if (!profile) return <div className="text-slate-400 text-sm">Loading…</div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Preferences</h1>
        <p className="text-sm text-slate-500">Configure your lead search settings</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input
                value={profile.company_name ?? ''}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value || null })}
                placeholder="Optional"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & Radius</CardTitle>
            <CardDescription>We search for property sales within this radius of your office</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Office postcode</Label>
              <Input
                value={profile.office_postcode}
                onChange={(e) => setProfile({ ...profile, office_postcode: e.target.value })}
                placeholder="e.g. SW1A 1AA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Search radius (miles)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={profile.search_radius_miles}
                onChange={(e) => setProfile({ ...profile, search_radius_miles: e.target.value as unknown as number })}
                onBlur={() => {
                  const parsed = parseInt(String(profile.search_radius_miles))
                  if (isNaN(parsed)) {
                    setProfile({ ...profile, search_radius_miles: 10 })
                  } else {
                    setProfile({ ...profile, search_radius_miles: Math.min(50, Math.max(5, parsed)) })
                  }
                }}
              />
              <p className="text-xs text-slate-400">We&apos;ll auto-expand up to 50 miles if fewer than 15 leads are found.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price Range</CardTitle>
            <CardDescription>Optional: filter properties by sale price</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Minimum price (£)</Label>
              <Input
                type="number"
                placeholder="No minimum"
                value={profile.min_price ?? ''}
                onChange={(e) => setProfile({ ...profile, min_price: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Maximum price (£)</Label>
              <Input
                type="number"
                placeholder="No maximum"
                value={profile.max_price ?? ''}
                onChange={(e) => setProfile({ ...profile, max_price: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Property Types</CardTitle>
            <CardDescription>Which property types should we include in your leads?</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {ALL_TYPES.map(([code, label]) => (
              <label key={code} className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={profile.property_types.includes(code)}
                  onCheckedChange={(checked) => toggleType(code, !!checked)}
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
      </form>
    </div>
  )
}
