import { describe, it, expect } from 'vitest'
import { formatSender } from '../resend'

describe('formatSender', () => {
  it('defaults to Housepost <info@housepost.co.uk>', () => {
    expect(formatSender(undefined)).toBe('Housepost <info@housepost.co.uk>')
    expect(formatSender('')).toBe('Housepost <info@housepost.co.uk>')
    expect(formatSender('   ')).toBe('Housepost <info@housepost.co.uk>')
  })

  it('adds the display name to a bare address', () => {
    expect(formatSender('info@housepost.co.uk')).toBe('Housepost <info@housepost.co.uk>')
    expect(formatSender('  info@housepost.co.uk  ')).toBe('Housepost <info@housepost.co.uk>')
  })

  it('keeps a value that already has a display name', () => {
    expect(formatSender('Housepost <info@housepost.co.uk>')).toBe('Housepost <info@housepost.co.uk>')
  })
})
