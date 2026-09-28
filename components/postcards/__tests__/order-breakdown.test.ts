import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const { orderBreakdown } = await import('../SendFlow')

const unit = { unitPricePence: 150 }

describe('orderBreakdown (fix list 4.7)', () => {
  it('one included card', () => {
    expect(orderBreakdown({ ...unit, quantity: 1, includedApplied: 1, payable: 0, costFormatted: '£0.00' }))
      .toBe('1 card: included in your plan')
  })

  it('two included cards', () => {
    expect(orderBreakdown({ ...unit, quantity: 2, includedApplied: 2, payable: 0, costFormatted: '£0.00' }))
      .toBe('2 cards: both included in your plan')
  })

  it('three or more included cards', () => {
    expect(orderBreakdown({ ...unit, quantity: 5, includedApplied: 5, payable: 0, costFormatted: '£0.00' }))
      .toBe('5 cards: all included in your plan')
  })

  it('some included, some paid', () => {
    expect(orderBreakdown({ ...unit, quantity: 7, includedApplied: 5, payable: 2, costFormatted: '£3.00' }))
      .toBe('7 cards: 5 included and 2 × £1.50 = £3.00')
  })

  it('none included', () => {
    expect(orderBreakdown({ ...unit, quantity: 3, includedApplied: 0, payable: 3, costFormatted: '£4.50' }))
      .toBe('3 cards: 3 × £1.50 = £4.50')
    expect(orderBreakdown({ ...unit, quantity: 1, includedApplied: 0, payable: 1, costFormatted: '£1.50' }))
      .toBe('1 card: 1 × £1.50 = £1.50')
  })

  it('never uses a long dash or "no charge"', () => {
    for (const q of [1, 2, 3]) {
      const text = orderBreakdown({ ...unit, quantity: q, includedApplied: q, payable: 0, costFormatted: '£0.00' })
      expect(text).not.toMatch(/—|no charge/)
    }
  })
})
