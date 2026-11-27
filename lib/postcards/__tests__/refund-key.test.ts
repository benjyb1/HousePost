import { describe, expect, it } from 'vitest'
import { cancelRefundKey } from '../refund-key'

describe('cancelRefundKey', () => {
  it('differs for two partial cancels of the same order', () => {
    expect(cancelRefundKey('order-1', ['job-a'])).not.toBe(cancelRefundKey('order-1', ['job-b', 'job-c']))
  })

  it('is the same for the same jobs in any order, so a retry reuses the refund', () => {
    expect(cancelRefundKey('order-1', ['job-b', 'job-a'])).toBe(cancelRefundKey('order-1', ['job-a', 'job-b']))
    expect(cancelRefundKey('order-1', ['job-a', 'job-a'])).toBe(cancelRefundKey('order-1', ['job-a']))
  })

  it('differs between orders and stays inside Stripe’s 255-character limit', () => {
    expect(cancelRefundKey('order-1', ['job-a'])).not.toBe(cancelRefundKey('order-2', ['job-a']))
    const many = Array.from({ length: 100 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`)
    expect(cancelRefundKey('6f1c2b8e-0000-4000-8000-000000000000', many).length).toBeLessThan(255)
  })
})
