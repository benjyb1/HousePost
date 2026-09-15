'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, ExternalLink, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Profile {
  subscription_status: string
  subscription_period_end: string | null
  postcards_used_this_period: number
  stripe_customer_id: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })

    fetch('/api/settings')
      .then((r) => r.json())
      .then(({ profile }) => setProfile(profile))
      .finally(() => setProfileLoading(false))
  }, [])

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated successfully')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSaving(false)
  }

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

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not delete your account')
        setDeleting(false)
        return
      }
      // Account and login are gone — sign out locally and send them to login.
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Your account has been deleted')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Could not delete your account')
      setDeleting(false)
    }
  }

  const isActive = ['active', 'trialing'].includes(profile?.subscription_status ?? '')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account</h1>
        <p className="text-sm text-slate-500">Manage your Housepost account and subscription</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account info</CardTitle>
          <CardDescription>Your email address associated with this account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email ?? 'Loading…'} disabled />
          </div>
        </CardContent>
      </Card>

      {/* Billing — merged in from the former Billing page. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </span>
            {!profileLoading && (
              <Badge
                className={
                  isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                }
              >
                {profile?.subscription_status ?? 'Inactive'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>£15/month · 5 postcards included · £1.50 per additional</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                {profile?.subscription_period_end && (
                  <p className="text-sm text-slate-600">
                    Next billing:{' '}
                    <strong>
                      {new Date(profile.subscription_period_end).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </strong>
                  </p>
                )}

                <p className="text-sm text-slate-600">
                  Postcards used this period:{' '}
                  <strong>{profile?.postcards_used_this_period ?? 0} / 5</strong>
                </p>
              </div>

              {isActive ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button variant="outline" onClick={openPortal} disabled={portalLoading}>
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    {portalLoading ? 'Opening…' : 'Manage billing'}
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
                  {checkoutLoading ? 'Redirecting…' : 'Subscribe – £15/month'}
                </Button>
              )}
              <p className="text-xs text-slate-400">
                View invoices, update your card or cancel any time in the Stripe billing portal.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <form onSubmit={handleChangePassword}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Update password'}
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Support — a simple line, no support-hours promise. */}
      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Need a hand? Email us at{' '}
            <a href="mailto:info@housepost.co.uk" className="text-primary hover:underline">
              info@housepost.co.uk
            </a>
            .
          </p>
        </CardContent>
      </Card>

      {/* Danger zone — permanent account deletion with type-to-confirm. */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and login. This cannot be undone. Any active
            subscription is cancelled. Your postcard sending history is retained for our records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="deleteConfirm">
              Type <span className="font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="deleteConfirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== 'DELETE' || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
