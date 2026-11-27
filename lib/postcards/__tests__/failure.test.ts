import { describe, expect, it } from 'vitest'
import { classifyDispatchError, isUnconfirmedDispatch } from '../failure'
import { StannpRequestError, stannpOutcome } from '../stannp'

describe('stannpOutcome', () => {
  it('treats a 5xx as unknown, whether or not the body parsed', () => {
    expect(stannpOutcome(500, true)).toBe('unknown')
    expect(stannpOutcome(502, false)).toBe('unknown')
    expect(stannpOutcome(504, false)).toBe('unknown')
  })

  it('treats a 4xx as a refusal', () => {
    expect(stannpOutcome(400, true)).toBe('rejected')
    expect(stannpOutcome(401, false)).toBe('rejected')
    expect(stannpOutcome(429, false)).toBe('rejected')
  })

  it('treats an unreadable 2xx as unknown and a readable success:false as a refusal', () => {
    expect(stannpOutcome(200, false)).toBe('unknown')
    expect(stannpOutcome(200, true)).toBe('rejected')
  })
})

describe('isUnconfirmedDispatch', () => {
  it('is true only for errors whose outcome is unknown', () => {
    expect(isUnconfirmedDispatch(new StannpRequestError('Stannp API timed out after 20s', 'unknown'))).toBe(true)
    expect(isUnconfirmedDispatch(new StannpRequestError('Stannp API error 504: non-JSON response', 'unknown', 504))).toBe(true)
    expect(isUnconfirmedDispatch(new StannpRequestError('Stannp API error 400: Insufficient funds', 'rejected', 400))).toBe(false)
    expect(isUnconfirmedDispatch(new Error('Postcard design snapshot is missing for this order'))).toBe(false)
    expect(isUnconfirmedDispatch(null)).toBe(false)
    expect(isUnconfirmedDispatch('timeout')).toBe(false)
  })
})

describe('classifyDispatchError', () => {
  it('keeps the categories for refusals', () => {
    expect(classifyDispatchError('Stannp API error 400: Insufficient funds').category).toBe('print_credit')
    expect(classifyDispatchError('Stannp API error 401: Unauthorized').category).toBe('printer')
    expect(classifyDispatchError('Stannp API error 400: invalid postcode').category).toBe('address')
    expect(classifyDispatchError('Stannp API error 429: rate limit').retryable).toBe(true)
    expect(classifyDispatchError('Stannp API network error: fetch failed (ENOTFOUND)').retryable).toBe(true)
  })
})
