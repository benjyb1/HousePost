import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from '../date'

describe('formatDateTime', () => {
  it('shows 24-hour UK time in summer (BST)', () => {
    expect(formatDateTime('2026-09-28T13:03:00Z')).toBe('28 Sept 2026, 14:03')
  })

  it('shows 24-hour UK time in winter (GMT)', () => {
    expect(formatDateTime('2026-12-01T14:03:00Z')).toBe('1 Dec 2026, 14:03')
  })

  it('handles the night the clocks go back', () => {
    // 00:30 UTC on 25 Oct 2026 is still BST (01:30); clocks change at 01:00 UTC.
    expect(formatDateTime('2026-10-25T00:30:00Z')).toBe('25 Oct 2026, 01:30')
    expect(formatDateTime('2026-10-25T01:30:00Z')).toBe('25 Oct 2026, 01:30')
  })
})

describe('formatDate', () => {
  it('uses the UK date, not the UTC one', () => {
    // 23:30 UTC on 27 Sep is 00:30 BST on the 28th.
    expect(formatDate('2026-09-27T23:30:00Z')).toBe('28 Sept 2026')
  })

  it('leaves plain dates on their own day', () => {
    expect(formatDate('2026-06-12')).toBe('12 Jun 2026')
    expect(formatDate('2026-01-12')).toBe('12 Jan 2026')
  })
})
