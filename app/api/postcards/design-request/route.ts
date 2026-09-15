import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeCustomDesignFee, CUSTOM_DESIGN_FEE_PENCE } from '@/lib/stripe/billing'
import { sendAdminAlert } from '@/lib/email/resend'
import { createNotification } from '@/lib/notifications'

/**
 * POST /api/postcards/design-request — the "Request custom design (£75)" flow
 * (feature 10.5).
 *
 * Body: JSON
 *   businessName  (required)  — the customer's business name
 *   colourScheme  (optional)  — brand colours / style
 *   text          (optional)  — copy to appear on the card
 *   notes         (optional)  — design pointers / anything else
 *   assets        (0..N)      — files the browser has ALREADY uploaded straight
 *                               into the private `design-request-assets` bucket
 *                               under `{userId}/design-requests/…`:
 *                               [{ path, name, type, size }]
 *
 * The files never pass through this route. Vercel caps a function's request
 * body at 4.5MB, so a multipart submit with a couple of logos in it used to
 * fail outright; the browser now uploads directly to storage (per-user-folder
 * RLS) and only the paths come here. The bucket is private, so the team reads
 * the assets via short-lived signed URLs in the brief email.
 *
 * On success we: charge the one-off £75 fee to the saved card UP FRONT, then
 * store the brief + asset references in `design_requests` and email the team
 * the brief. A declined card aborts everything and NOTHING is recorded as a
 * paid request (402). The response never reveals how the design is fulfilled.
 *
 * Resubmitting the SAME brief (double click, or a retry after a network wobble)
 * is safe: the request id, the Stripe idempotency key and the PaymentIntent
 * metadata are all derived from the brief itself, so Stripe returns the
 * original PaymentIntent instead of charging again, and the existing request
 * row is returned with `duplicate: true` instead of a second row.
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

export const ASSET_BUCKET = 'design-request-assets'
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Deterministic UUID (v4-shaped) from a SHA-256 of the input. */
function uuidFromHash(input: string): string {
  const h = createHash('sha256').update(input).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

type AssetRef = { path: string; name: string; type: string; size: number }

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse the brief ────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid form submission' }, { status: 400 })
  }

  const businessName = String(body.businessName ?? '').trim()
  const colourScheme = String(body.colourScheme ?? '').trim()
  const text = String(body.text ?? '').trim()
  const notes = String(body.notes ?? '').trim()
  const rawAssets = Array.isArray(body.assets) ? (body.assets as unknown[]) : []

  if (!businessName) {
    return NextResponse.json({ error: 'Please add your business name.' }, { status: 400 })
  }
  if (rawAssets.length > MAX_FILES) {
    return NextResponse.json({ error: `Please attach at most ${MAX_FILES} files.` }, { status: 400 })
  }

  // Validate every asset reference: it must sit in THIS user's folder of the
  // private bucket and be an allowed type/size. A path outside the folder (or
  // in another bucket) is rejected outright — the browser can only have
  // uploaded within its own folder anyway (RLS), but never trust the client.
  const prefix = `${user.id}/design-requests/`
  const assets: AssetRef[] = []
  for (const a of rawAssets) {
    const r = (a ?? {}) as Record<string, unknown>
    const path = String(r.path ?? '')
    const name = String(r.name ?? '').slice(0, 200)
    const type = String(r.type ?? '')
    const size = Number(r.size ?? 0)
    if (!path.startsWith(prefix) || path.includes('..')) {
      return NextResponse.json({ error: 'One of the attached files could not be verified.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: `“${name || path}” is not a supported file type.` }, { status: 400 })
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `“${name || path}” is too large (max 15MB).` }, { status: 400 })
    }
    assets.push({ path, name: name || path.split('/').pop() || 'file', type, size })
  }

  if (!notes && !text && assets.length === 0) {
    return NextResponse.json(
      { error: 'Add some notes, text, or an asset so we have something to work from.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Confirm the referenced files really exist (the upload may have failed
  // silently in the browser, or the path may be made up).
  for (const a of assets) {
    const folder = a.path.slice(0, a.path.lastIndexOf('/'))
    const file = a.path.slice(a.path.lastIndexOf('/') + 1)
    const { data: listing, error: listErr } = await admin.storage.from(ASSET_BUCKET).list(folder, { search: file })
    if (listErr || !listing?.some((o) => o.name === file)) {
      return NextResponse.json(
        { error: `“${a.name}” did not finish uploading. Please remove it and add it again.` },
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

  // ── Identity of THIS brief ─────────────────────────────────────────────────
  // Everything Stripe sees (idempotency key AND metadata) is derived from the
  // brief, so a resubmit of the same brief reuses the same PaymentIntent. Two
  // genuinely different briefs get different ids and are charged independently.
  const briefFingerprint = createHash('sha256')
    .update([user.id, businessName, colourScheme, text, notes].join('|'))
    .digest('hex')
    .slice(0, 40)
  const requestId = uuidFromHash(`design-request:${briefFingerprint}`)
  const idempotencyKey = `custom-design:${briefFingerprint}`

  // Already recorded? Then the fee was taken last time — return that request
  // rather than storing (or billing) a second one.
  const { data: existing } = await admin
    .from('design_requests')
    .select('id, assets')
    .eq('id', requestId)
    .maybeSingle()
  if (existing) {
    // Keep any newly uploaded files with the request so nothing the customer
    // added on the retry is lost.
    const known = new Set(((existing.assets as AssetRef[]) ?? []).map((a) => a.path))
    const merged = [...((existing.assets as AssetRef[]) ?? []), ...assets.filter((a) => !known.has(a.path))]
    if (merged.length !== known.size) {
      await admin.from('design_requests').update({ assets: merged, updated_at: new Date().toISOString() }).eq('id', requestId)
    }
    return NextResponse.json(
      {
        success: true,
        duplicate: true,
        requestId,
        amountPence: CUSTOM_DESIGN_FEE_PENCE,
        amountFormatted: `£${(CUSTOM_DESIGN_FEE_PENCE / 100).toFixed(2)}`,
      },
      { status: 200 }
    )
  }

  // ── Charge the £75 fee UP FRONT ────────────────────────────────────────────
  // Do this BEFORE we store anything so a declined card records no paid request.
  let paymentIntentId: string
  try {
    const { paymentIntentId: pi } = await chargeCustomDesignFee({
      customerId: profile.stripe_customer_id as string,
      idempotencyKey,
      metadata: { userId: user.id, requestId, kind: 'custom_design_fee' },
    })
    paymentIntentId = pi
  } catch (err) {
    const e = err as Error & { type?: string; code?: string }
    const isCardDecline =
      e.type === 'StripeCardError' ||
      e.code === 'card_declined' ||
      e.code === 'authentication_required' ||
      e.code === 'no_payment_method'

    if (isCardDecline) {
      // No money moved — safe to refuse and record nothing as a paid request.
      return NextResponse.json({ error: e.message || 'Your card was declined.' }, { status: 402 })
    }

    // Any OTHER failure (network/timeout, Stripe API error): the charge MAY have
    // gone through. A customer retry reuses the same key/metadata, so Stripe
    // would hand back the same PaymentIntent — no double charge — but the
    // honest thing is to send them to support. Alert the team and return 500.
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[design-request] charge failed (non-decline) for user ${user.id}:`, msg)
    try {
      await sendAdminAlert(
        `[Housepost] Custom design charge failed and needs review — ${businessName}`,
        `<p>A £75 custom-design charge for user <strong>${escapeHtml(user.id)}</strong>
          (<strong>${escapeHtml(businessName)}</strong>, request <strong>${escapeHtml(requestId)}</strong>) failed
          with a NON-decline error. The charge MAY have succeeded. The idempotency key is stable, so a
          customer retry cannot double-charge, but please check Stripe and follow up.</p><pre>${escapeHtml(msg)}</pre>`
      )
    } catch (alertErr) {
      console.error('[design-request] charge-failure alert failed:', alertErr)
    }
    return NextResponse.json(
      {
        error:
          'Something went wrong while taking payment. Our team has been notified — please check with support before trying again.',
      },
      { status: 500 }
    )
  }

  // ── Charge settled — store the brief ───────────────────────────────────────
  const { error: insertError } = await admin.from('design_requests').upsert(
    {
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
    },
    { onConflict: 'id' }
  )

  if (insertError) {
    // The card was charged, so we must not fail silently. Still email the team
    // the full brief so the request is actioned.
    console.error('[design-request] insert failed after charge:', insertError.message)
  }

  // ── Notify the team with the brief (signed links to the private assets) ────
  try {
    const assetLines: string[] = []
    for (const a of assets) {
      const { data: signed } = await admin.storage.from(ASSET_BUCKET).createSignedUrl(a.path, SIGNED_URL_SECONDS)
      const link = signed?.signedUrl
        ? `<a href="${escapeHtml(signed.signedUrl)}">${escapeHtml(a.name)}</a>`
        : escapeHtml(a.name)
      assetLines.push(`<li>${link} (${escapeHtml(a.type)}, ${Math.round(a.size / 1024)} KB) — <code>${escapeHtml(a.path)}</code></li>`)
    }

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
       <p><strong>Assets</strong> (links valid for 7 days; the files stay in the private
          <code>${ASSET_BUCKET}</code> bucket):</p>
       ${assetLines.length ? `<ul>${assetLines.join('')}</ul>` : '<p>No assets attached.</p>'}
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
