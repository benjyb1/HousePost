/**
 * Derive an opaque admin session token from ADMIN_PASSWORD.
 *
 * The admin-auth cookie holds this token rather than the raw password, so a
 * leaked cookie (logs, proxies, etc.) doesn't expose the actual credential.
 * Uses Web Crypto so it runs in both the Node routes and the Edge proxy.
 */
export async function adminToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? ''
  const data = new TextEncoder().encode(`housepost-admin-session:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time comparison of two hex strings of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
