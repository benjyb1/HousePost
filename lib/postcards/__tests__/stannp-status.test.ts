import { describe, it, expect } from 'vitest'
import { normaliseFulfilmentStatus, isTerminalStatus } from '../stannp-status'

describe('normaliseFulfilmentStatus', () => {
  it('maps the provider mailpiece statuses (fix list 7.2)', () => {
    expect(normaliseFulfilmentStatus('producing')).toBe('production')
    expect(normaliseFulfilmentStatus('handed_over')).toBe('dispatched')
    expect(normaliseFulfilmentStatus('Handed Over')).toBe('dispatched')
    expect(normaliseFulfilmentStatus('in_transit')).toBe('dispatched')
    expect(normaliseFulfilmentStatus('local_delivery')).toBe('local_delivery')
    expect(normaliseFulfilmentStatus('local delivery')).toBe('local_delivery')
    expect(normaliseFulfilmentStatus('delivered')).toBe('delivered')
    expect(normaliseFulfilmentStatus('returned')).toBe('returned')
    expect(normaliseFulfilmentStatus('cancelled')).toBe('cancelled')
  })

  it('keeps unknown values neutral', () => {
    expect(normaliseFulfilmentStatus('something_new')).toBe('processing')
    expect(normaliseFulfilmentStatus('')).toBeNull()
  })
})

describe('isTerminalStatus', () => {
  it('keeps polling a dispatched card so delivery can be reported', () => {
    expect(isTerminalStatus('dispatched')).toBe(false)
    expect(isTerminalStatus('local_delivery')).toBe(false)
  })

  it('stops at delivered, returned and the dead states', () => {
    for (const s of ['delivered', 'returned', 'failed', 'cancelled', 'error']) {
      expect(isTerminalStatus(s)).toBe(true)
    }
  })
})
