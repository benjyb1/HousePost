import { describe, it, expect } from 'vitest'
import { isInAppNavigation } from '../useLeaveGuard'

const here = new URL('https://housepost.co.uk/postcards/design')

describe('isInAppNavigation', () => {
  it('intercepts same-origin path changes', () => {
    expect(isInAppNavigation(new URL('https://housepost.co.uk/dashboard'), here)).toBe(true)
  })
  it('ignores external links, hash links and the same page', () => {
    expect(isInAppNavigation(new URL('https://stannp.com/'), here)).toBe(false)
    expect(isInAppNavigation(new URL('https://housepost.co.uk/postcards/design#top'), here)).toBe(false)
    expect(isInAppNavigation(new URL('https://housepost.co.uk/postcards/design'), here)).toBe(false)
  })
})
