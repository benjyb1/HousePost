'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, ExternalLink, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect } from 'react'

interface Profile {
  subscription_status: string
  subscription_period_end: string | null
  postcards_used_this_period: number
  stripe_customer_id: string | null
}

export default function BillingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(({ profile }) => setProfile(profile))
      .finally(() => setLoading(false))
  }, [])

  async function openPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error ?? 'Could not open billing portal')
    } catch {
      toast.error('Could not open billing portal')
    }
    setPortalLoading(false)
  }

  async function openCheckout() {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/billing/create-checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error ?? 'Could not start checkout')
    } catch {
      toast.error('Could not start checkout')
    }
    setCheckoutLoading(false)
  }

  if (loading) return <div className="text-slate-400 text-sm">Loading…</div>

  const isActive = ['active', 'trialing'].includes(profile?.subscription_status ?? '')

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500">Manage your subscription and postcards</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </span>
            <Badge
              className={
                isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600'
              }
            >
              {profile?.subscription_status ?? 'Inactive'}
            </Badge>
          </CardTitle>
          <CardDescription>£15/month · 5 postcards included · £1 per additional</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.subscription_period_end && (
            <p className="text-sm text-slate-600">
              Next billing:{' '}
              {new Date(profile.subscription_period_end).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-600">
              Postcards used this period:{' '}
              <strong>{profile?.postcards_used_this_period ?? 0} / 5</strong>
            </p>
          </div>

          {isActive ? (
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={openPortal} disabled={portalLoading}>
                <ExternalLink className="h-4 w-4 mr-1.5" />
                {portalLoading ? 'Opening…' : 'Manage subscription'}
              </Button>
              <Button
                variant="ghost"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={openPortal}
                disabled={portalLoading}
              >
                Cancel subscription
              </Button>
            </div>
          ) : (
            <Button onClick={openCheckout} disabled={checkoutLoading}>
              {checkoutLoading ? 'Redirecting…' : 'Subscribe — £15/month'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s included</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            'Monthly UK Land Registry property leads',
            'Automatic radius expansion to ensure 15+ leads',
            '5 postcards included per month',
            'PostGrid printing & Royal Mail delivery',
            'Lead sorting by price and distance',
            'Postcard tracking (printing → mailed → delivered)',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
