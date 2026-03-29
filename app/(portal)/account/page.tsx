'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account</h1>
        <p className="text-sm text-slate-500">Manage your Housepost account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
          <CardDescription>Your email address associated with this account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email ?? 'Loading...'} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
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
              {saving ? 'Saving...' : 'Update password'}
            </Button>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
          <CardDescription>Need help?</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Get in touch at{' '}
            <a
              href="mailto:support@housepost.co.uk"
              className="text-primary hover:underline"
            >
              support@housepost.co.uk
            </a>
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            We typically respond within 24 hours.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
