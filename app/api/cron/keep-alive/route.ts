import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// A second, independent keep-alive that doesn't depend on GitHub Actions staying
// enabled. Vercel triggers this on a schedule (see vercel.json) and the trivial
// DB read keeps the free-tier Supabase project from idling into a pause. The
// GitHub keep-alive workflow still runs too — belt and braces.
export const dynamic = 'force-dynamic'

function authorised(request: Request): boolean {
  // Vercel injects `Authorization: Bearer $CRON_SECRET` on scheduled runs when
  // CRON_SECRET is set. Enforce it when present; if it isn't configured, still
  // allow (the endpoint only does a trivial read and returns no data).
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('pipeline_runs').select('id').limit(1)

  if (error) {
    console.error('Keep-alive query failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() })
}
