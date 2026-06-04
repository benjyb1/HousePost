import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createPostcardPreview,
  buildRecipientContact,
  generateFrontHtml,
  generateBackHtml,
} from '@/lib/postcards/postgrid'

/**
 * POST: render an exact print proof of the user's current postcard design.
 *
 * This goes through PostGrid's TEST sandbox, so nothing is printed, posted or
 * charged — it just returns the same PDF the printer would produce. We feed it a
 * sample recipient and a sample recent-sale so the back reads realistically;
 * none of it is a real lead and nothing is written to the database.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.POSTGRID_TEST_API_KEY) {
    return NextResponse.json(
      {
        error:
          'Preview is not configured yet. Add your PostGrid test key as POSTGRID_TEST_API_KEY.',
      },
      { status: 503 }
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, postcard_design_url, postcard_design_back_url')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const senderName = (profile.full_name as string | null) ?? 'Housepost'

  const frontHtml = generateFrontHtml({
    senderName,
    designUrl: profile.postcard_design_url as string | null,
  })

  // Sample sale details so the default back template renders the way a real
  // dispatch would. These are illustrative only.
  const backHtml = generateBackHtml({
    recipientAddress: '12 Sample Street, Aylesbury',
    price: 42_500_000, // pence — generateBackHtml divides by 100 → £425,000
    propertyType: 'Detached house',
    saleDate: '1 May 2026',
    senderName,
    backDesignUrl: profile.postcard_design_back_url as string | null,
  })

  const recipient = buildRecipientContact(
    '12 Sample Street, Aylesbury',
    'HP20 1AB',
    'Sample Resident'
  )

  try {
    const { url } = await createPostcardPreview(recipient, frontHtml, backHtml, '6x4')
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to render preview' },
      { status: 502 }
    )
  }
}
