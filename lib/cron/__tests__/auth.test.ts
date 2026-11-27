import { afterEach, describe, expect, it } from 'vitest'
import { verifyCronRequest } from '../auth'

const saved = process.env.CRON_SECRET
afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = saved
})
const req = (auth?: string) => new Request('https://x.test/api/cron/x', { headers: auth ? { authorization: auth } : {} })

describe('verifyCronRequest', () => {
  it('accepts only the right secret', () => {
    process.env.CRON_SECRET = 's3cret'
    expect(verifyCronRequest(req('Bearer s3cret'))).toBe(true)
    expect(verifyCronRequest(req('Bearer wrong'))).toBe(false)
    expect(verifyCronRequest(req())).toBe(false)
  })

  it('refuses everything when the secret is unset or empty', () => {
    delete process.env.CRON_SECRET
    expect(verifyCronRequest(req('Bearer undefined'))).toBe(false)
    expect(verifyCronRequest(req('Bearer '))).toBe(false)
    process.env.CRON_SECRET = ''
    expect(verifyCronRequest(req('Bearer '))).toBe(false)
  })
})
