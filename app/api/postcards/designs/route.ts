import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { designGroupKey, isDesignInUse } from '@/lib/utils/design-files'

/**
 * The saved postcard-design LIBRARY (see migration 20260920000002).
 *
 * A row is a snapshot of a design the customer made or uploaded: a front image
 * (always) and an optional back. It is SEPARATE from the ACTIVE design, which
 * still lives on `profiles.postcard_design_url` / `postcard_design_back_url` and
 * is what the send pipeline reads. "Set as active" is handled by the existing
 * PATCH /api/settings route copying a library row's urls onto those pointers.
 *
 * Older saves all overwrote one fixed file per side and differed only by a
 * `?v=` cache-buster, so a user can have many rows that are really one design.
 * GET shows one entry per front+back file pair (the newest), and DELETE removes
 * the whole group so an older copy can't take its place. Storage files are
 * never deleted here: a held order may still fetch one during its cool-off.
 */

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS scopes this to the owner's rows.
  const { data, error } = await supabase
    .from('postcard_designs')
    .select('id, label, source, front_url, back_url, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Newest first, so the first row seen for each file pair is the one to keep.
  const seen = new Set<string>()
  const designs = (data ?? []).filter((row) => {
    const key = designGroupKey(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return NextResponse.json({ designs })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    label?: unknown
    source?: unknown
    front_url?: unknown
    back_url?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Both success paths below return the full row, INCLUDING `id`. The template
  // editor keys its save/resume sidecar (`${userId}/design-editor/${id}.json`)
  // to this id, so keep it in the response.
  const source = body.source
  const frontUrl = typeof body.front_url === 'string' ? body.front_url.trim() : ''
  const backUrl = typeof body.back_url === 'string' && body.back_url.trim() ? body.back_url.trim() : null
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 120) : null

  if (source !== 'template' && source !== 'upload') {
    return NextResponse.json({ error: 'Invalid design source' }, { status: 400 })
  }
  if (!frontUrl) {
    return NextResponse.json({ error: 'A front design is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Don't clutter the library with identical rows. If the newest saved design
  // already matches this exact front+back pair, reuse it rather than inserting a
  // duplicate (the urls are cache-busted per save, so an identical pair means
  // nothing actually changed).
  const { data: existing } = await admin
    .from('postcard_designs')
    .select('id, label, source, front_url, back_url, created_at')
    .eq('user_id', user.id)
    .eq('front_url', frontUrl)
    .order('created_at', { ascending: false })
    .limit(1)

  const match = existing?.[0]
  if (match && (match.back_url ?? null) === backUrl) {
    return NextResponse.json({ design: match, deduped: true })
  }

  const finalLabel = label ?? autoLabel(source)

  const { data, error } = await admin
    .from('postcard_designs')
    .insert({
      user_id: user.id,
      label: finalLabel,
      source,
      front_url: frontUrl,
      back_url: backUrl,
    })
    .select('id, label, source, front_url, back_url, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ design: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing design id' }, { status: 400 })

  // RLS scopes every read and delete below to the owner's rows.
  const { data: target, error: findError } = await supabase
    .from('postcard_designs')
    .select('id, front_url, back_url')
    .eq('id', id)
    .maybeSingle()
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: 'That design is no longer in your library' }, { status: 404 })

  // The design being sent can't be deleted. The library hides the button for
  // it; this is the same rule on the server.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('postcard_design_url, postcard_design_back_url')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    return NextResponse.json({ error: 'Could not check which design is in use' }, { status: 500 })
  }
  if (
    isDesignInUse(
      target,
      profile.postcard_design_url as string | null,
      profile.postcard_design_back_url as string | null
    )
  ) {
    return NextResponse.json(
      { error: 'This is the card being sent. Set another design as active first, then delete this one.' },
      { status: 409 }
    )
  }

  // Every other row of this user that points at the same front and back files
  // is the same design, so it goes too.
  const { data: rows, error: listError } = await supabase
    .from('postcard_designs')
    .select('id, front_url, back_url')
    .eq('user_id', user.id)
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

  const key = designGroupKey(target)
  const ids = (rows ?? []).filter((row) => designGroupKey(row) === key).map((row) => row.id as string)
  if (!ids.includes(target.id as string)) ids.push(target.id as string)

  // Removing library rows never touches the active-design profile pointers or
  // the files in storage.
  const { error } = await supabase
    .from('postcard_designs')
    .delete()
    .eq('user_id', user.id)
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, removed: ids.length })
}

/** e.g. "Bold template · 15 Sep" / "Uploaded design · 15 Sep". */
function autoLabel(source: 'template' | 'upload'): string {
  const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date())
  return source === 'template' ? `Template · ${when}` : `Uploaded design · ${when}`
}
