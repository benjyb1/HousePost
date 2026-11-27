import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from '../safe-redirect'

const origin = 'https://www.housepost.co.uk'

describe('safeRedirectPath', () => {
  it('keeps ordinary in-site paths, with query and hash', () => {
    expect(safeRedirectPath('/postcards', '/dashboard', origin)).toBe('/postcards')
    expect(safeRedirectPath('/postcards/design?tab=2#top', '/dashboard', origin)).toBe(
      '/postcards/design?tab=2#top'
    )
  })

  it('falls back when nothing was given', () => {
    expect(safeRedirectPath(null, '/dashboard', origin)).toBe('/dashboard')
    expect(safeRedirectPath('', '/dashboard', origin)).toBe('/dashboard')
    expect(safeRedirectPath(undefined, '/billing', origin)).toBe('/billing')
  })

  it.each([
    '//evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    '\\\\evil.com',
    'https://evil.com',
    '@evil.com',
    'evil.com',
    'javascript:alert(1)',
    '/\t/evil.com',
    '/\n/evil.com',
    ' //evil.com',
  ])('refuses %j', (value) => {
    expect(safeRedirectPath(value, '/dashboard', origin)).toBe('/dashboard')
  })

  it('never hands back something that leaves the origin', () => {
    const out = safeRedirectPath('/%2F%2Fevil.com', '/dashboard', origin)
    expect(new URL(out, origin).origin).toBe(origin)
  })
})
