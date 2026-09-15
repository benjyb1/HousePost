import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPostcardPreview, buildRecipient } from '@/lib/postcards/stannp'
import { resolveBackUrl } from '@/lib/postcards/defaults'

/**
 * POST: render an exact print proof of the user's current postcard design.
 *
 * This runs through Stannp's test mode, so nothing is printed, posted or charged
 * — it returns the same print-ready PDF a live order would produce, against a
 * sample recipient so the address area reads realistically. Nothing is written
 * to the database.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.STANNP_API_KEY) {
    return NextResponse.json(
      { error: 'Preview is not configured yet. Add your Stannp key as STANNP_API_KEY.' },
      { status: 503 }
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('postcard_design_url, postcard_design_back_url')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const frontUrl = profile.postcard_design_url as string | null
  // Without a back design the proof shows the blank default back, which is
  // exactly what would print.
  const backUrl = resolveBackUrl(profile.postcard_design_back_url as string | null)
  if (!frontUrl) {
    return NextResponse.json(
      { error: 'Add a front design first, then preview the exact printed card.' },
      { status: 400 }
    )
  }

  // Sample recipient so Stannp's address clear zone renders the way a real
  // dispatch would. Illustrative only — not a real lead.
  const recipient = buildRecipient('12 Sample Street, Aylesbury', 'HP20 1AB', 'Sample Resident')

  try {
    const { url } = await createPostcardPreview({ to: recipient, frontUrl, backUrl })
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to render preview' },
      { status: 502 }
    )
  }
}
