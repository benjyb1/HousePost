export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { TrackingSendProvider } from '@/components/postcards/TrackingSend'
import { TrackingBatches } from '@/components/portal/tracking/TrackingBatches'
import { fromJob, type PostcardJobRow } from '@/components/portal/tracking/model'

export const metadata: Metadata = {
  title: 'Tracking',
  description: 'Track the postcards you have sent and the ones waiting to go.',
}

function serverNow(): string {
  return new Date().toISOString()
}

export default async function PostcardsPage() {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()])
  if (!user) return null

  const [{ data: jobsData }, { data: profile }] = await Promise.all([
    supabase
      .from('postcard_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('postcard_design_back_url').eq('id', user.id).single(),
  ])

  // Only the fields the page shows go to the browser, never failure details.
  const cards = ((jobsData ?? []) as unknown as PostcardJobRow[]).map(fromJob)
  // Empty back: "Send again" warns before a blank back goes out, as on Home.
  const hasBackDesign = Boolean((profile?.postcard_design_back_url as string | null)?.trim())

  return (
    <TrackingSendProvider hasBackDesign={hasBackDesign}>
      <TrackingBatches cards={cards} now={serverNow()} />
    </TrackingSendProvider>
  )
}
