import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeCustomDesignFee, CUSTOM_DESIGN_FEE_PENCE } from '@/lib/stripe/billing'
import { sendAdminAlert } from '@/lib/email/resend'
import { createNotification } from '@/lib/notifications'

/**
 * POST /api/postcards/design-request — the "Request custom design (£75)" flow
 * (feature 10.5).
 *
 * Body: multipart/form-data
 *   businessName  (required)  — the customer's business name
 *   colourScheme  (optional)  — brand colours / style
 *   text          (optional)  — copy to appear on the card
 *   notes         (optional)  — design pointers / anything else
 *   assets        (0..N files) — logo, photos, PDFs, etc.
 *
 * On success we: charge the one-off £75 fee to the saved card UP FRONT, then
 * store the brief + uploaded assets in `design_requests` and email the team the
 * brief. A declined card aborts everything and NOTHING is recorded as a paid
 * request (402). The response never reveals how the design is fulfilled.
 */

const MAX_FILES = 10
const MAX_FILE_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
])

const BUCKET = 'postcard-designs'

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse the multipart brief ──────────────────────────────────────────────
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form submission' }, { status: 400 })
  }

  const businessName = String(form.get('businessName') ?? '').trim()
  const colourScheme = String(form.get('colourScheme') ?? '').trim()
  const text = String(form.get('text') ?? '').trim()
  const notes = String(form.get('notes') ?? '').trim()

  if (!businessName) {
    return NextResponse.json({ error: 'Please add your business name.' }, { status: 400 })
  }
  if (!notes && !text && form.getAll('assets').filter((a) => a instanceof File && a.size > 0).length === 0) {
    return NextResponse.json(
      { error: 'Add some notes, text, or an asset so we have something to work from.' },
      { status: 400 }
    )
  }

  const files = form
    .getAll('assets')
    .filter((a): a is File => a instanceof File && a.size > 0)

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Please attach at most ${MAX_FILES} files.` }, { status: 400 })
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `“${f.name}” is too large (max 15MB).` }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(f.type)) {
      return NextResponse.json(
        { error: `“${f.name}” is not a supported file type.` },
        { status: 400 }
      )
    }
  }

  // ── Billing prerequisites ──────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (!profile.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No payment method on file. Add a card in Billing before requesting a custom design.' },
      { status: 402 }
    )
  }

  const requestId = randomUUID()

  // ── Charge the £75 fee UP FRONT ────────────────────────────────────────────
  // Do this BEFORE we store anything so a declined card records no paid request.
  let paymentIntentId: string
  try {
    const { paymentIntentId: pi } = await chargeCustomDesignFee({
      customerId: profile.stripe_customer_id as string,
      idempotencyKey: `custom-design:${requestId}`,
      metadata: { userId: user.id, requestId, kind: 'custom_design_fee' },
    })
    paymentIntentId = pi
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Your card was declined.'
    return NextResponse.json({ error: msg }, { status: 402 })
  }

  // ── Charge settled — store the brief + assets ──────────────────────────────
  const admin = createAdminClient()

  const assets: { path: string; name: string; type: string; size: number }[] = []
  for (const f of files) {
    const path = `${user.id}/design-requests/${requestId}/${safeName(f.name)}`
    try {
      const buffer = Buffer.from(await f.arrayBuffer())
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: f.type, upsert: true })
      if (uploadError) throw uploadError
      assets.push({ path, name: f.name, type: f.type, size: f.size })
    } catch (err) {
      // A single failed asset must not lose the paid request — log and continue.
      console.error(`[design-request] asset upload failed (${f.name}):`, err)
    }
  }

  const { error: insertError } = await admin.from('design_requests').insert({
    id: requestId,
    user_id: user.id,
    status: 'received',
    business_name: businessName,
    colour_scheme: colourScheme || null,
    brief_text: text || null,
    notes: notes || null,
    assets,
    amount_pence: CUSTOM_DESIGN_FEE_PENCE,
    stripe_payment_intent_id: paymentIntentId,
  })

  if (insertError) {
    // The card was charged, so we must not fail silently. Still email the team
    // the full brief so the request is actioned, and surface a soft warning.
    console.error('[design-request] insert failed after charge:', insertError.message)
  }

  // ── Notify the team (Freddie) with the brief ───────────────────────────────
  try {
    const assetLines = assets.length
      ? `<ul>${assets.map((a) => `<li>${escapeHtml(a.name)} (${escapeHtml(a.type)}) — <code>${escapeHtml(a.path)}</code></li>`).join('')}</ul>`
      : '<p>No assets attached.</p>'

    await sendAdminAlert(
      `[Housepost] New custom design request — ${businessName}`,
      `<p>A customer has requested a custom postcard design (£75 paid).</p>
       <p><strong>Request id:</strong> ${escapeHtml(requestId)}<br/>
          <strong>User id:</strong> ${escapeHtml(user.id)}<br/>
          <strong>Business:</strong> ${escapeHtml(businessName)}<br/>
          <strong>Colours / style:</strong> ${escapeHtml(colourScheme || '—')}<br/>
          <strong>Payment intent:</strong> ${escapeHtml(paymentIntentId)}</p>
       <p><strong>Card text:</strong><br/>${escapeHtml(text || '—').replace(/\n/g, '<br/>')}</p>
       <p><strong>Notes / pointers:</strong><br/>${escapeHtml(notes || '—').replace(/\n/g, '<br/>')}</p>
       <p><strong>Assets:</strong></p>
       ${assetLines}
       ${insertError ? '<p style="color:#c53030;"><strong>Warning:</strong> the design_requests row failed to save — action from this email.</p>' : ''}`
    )
  } catch (err) {
    console.error('[design-request] admin alert failed:', err)
  }

  // ── Confirm to the customer (best-effort in-app notification) ──────────────
  try {
    await createNotification({
      userId: user.id,
      type: 'custom_design_requested',
      title: 'Custom design request received',
      body: 'Thanks — we’ve got your brief and taken the £75 design fee. Our team will be in touch about your postcard.',
      href: '/postcards/design',
    })
  } catch (err) {
    console.error('[design-request] notification failed:', err)
  }

  return NextResponse.json(
    {
      success: true,
      requestId,
      amountPence: CUSTOM_DESIGN_FEE_PENCE,
      amountFormatted: `£${(CUSTOM_DESIGN_FEE_PENCE / 100).toFixed(2)}`,
    },
    { status: 201 }
  )
}
