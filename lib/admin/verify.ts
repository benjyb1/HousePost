import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/admin/token'

/** True when the request carries a valid, unexpired admin-auth cookie. Server-side only. */
export async function verifyAdminCookie(): Promise<boolean> {
  const cookieStore = await cookies()
  return verifyAdminToken(cookieStore.get('admin-auth')?.value)
}
