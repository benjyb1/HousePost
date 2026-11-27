/**
 * Admin session tokens.
 *
 * The admin-auth cookie holds `<expiry ms>.<HMAC>`, signed with a key derived
 * from ADMIN_PASSWORD and CRON_SECRET. So the cookie never carries the
 * password, it stops working after ADMIN_SESSION_MS whatever the browser does
 * with it, and changing either secret signs everyone out. With ADMIN_PASSWORD
 * unset, nothing verifies and admin is shut.
 *
 * Uses Web Crypto so it runs in both the Node routes and the proxy.
 */

export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000 // 12 hours

/** Admin is only open when a password is configured. */
export function adminConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD ?? '').length > 0
}

const encoder = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signingKey(): Promise<CryptoKey | null> {
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (!password) return null
  const material = encoder.encode(`housepost-admin-session:v2\n${password}\n${process.env.CRON_SECRET ?? ''}`)
  const raw = await crypto.subtle.digest('SHA-256', material)
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function sign(key: CryptoKey, expiresAt: number): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(`admin:${expiresAt}`)))
}

/** A fresh session token, valid for ADMIN_SESSION_MS. Throws if admin isn't configured. */
export async function createAdminToken(now = Date.now()): Promise<string> {
  const key = await signingKey()
  if (!key) throw new Error('ADMIN_PASSWORD is not set')
  const expiresAt = now + ADMIN_SESSION_MS
  return `${expiresAt}.${await sign(key, expiresAt)}`
}

/** True for a token we signed that hasn't expired. */
export async function verifyAdminToken(token: string | null | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false
  const key = await signingKey()
  if (!key) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expiresAt = Number(token.slice(0, dot))
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false
  // A token can't be valid for longer than one session from now.
  if (expiresAt > now + ADMIN_SESSION_MS + 60_000) return false
  return safeEqualHex(token.slice(dot + 1), await sign(key, expiresAt))
}

/** Constant-time comparison of two hex strings of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
