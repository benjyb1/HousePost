/**
 * Turn a user-supplied "send me here after sign-in" value into a path on this
 * site, or the fallback.
 *
 * Only same-origin relative paths get through. `//evil.com`, `/\evil.com`
 * (browsers read `\` as `/`), `https://evil.com`, `@evil.com` and anything
 * with control characters are refused. The value is resolved against the
 * site's own origin and the result must still be on that origin.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
  origin = 'https://housepost.invalid'
): string {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  // Backslashes and control characters (tabs and newlines are stripped by the
  // URL parser, which can turn `/\t/evil.com` into `//evil.com`).
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  if (value.startsWith('//')) return fallback

  let url: URL
  try {
    url = new URL(value, origin)
  } catch {
    return fallback
  }
  if (url.origin !== new URL(origin).origin) return fallback
  return `${url.pathname}${url.search}${url.hash}`
}
