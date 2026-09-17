import { cookies } from 'next/headers'
import { adminToken, safeEqualHex } from '@/lib/admin/token'

/** True when the request carries a valid admin-auth cookie. Server-side only. */
export async function verifyAdminCookie(): Promise<boolean> {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('admin-auth')?.value
  if (!adminCookie) return false
  return safeEqualHex(adminCookie, await adminToken())
}
