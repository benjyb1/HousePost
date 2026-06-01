import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { adminToken, safeEqualHex } from '@/lib/admin/token'

async function verifyAdminCookie(): Promise<boolean> {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('admin-auth')?.value
  if (!adminCookie) return false
  return safeEqualHex(adminCookie, await adminToken())
}

export async function GET() {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, office_postcode, subscription_status, subscription_period_end, postcards_used_this_period, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach lead/postcard counts per client
  const enriched = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { count: leadCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', p.id)

      const { count: postcardCount } = await supabase
        .from('postcard_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', p.id)

      return { ...p, totalLeads: leadCount ?? 0, totalPostcards: postcardCount ?? 0 }
    })
  )

  return NextResponse.json({ clients: enriched })
}
