import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ADMIN_SESSION_MS, adminConfigured, createAdminToken, verifyAdminToken } from '../token'
import { afterFailedAttempt, isLockedOut, ADMIN_ATTEMPT_WINDOW_MS, MAX_ADMIN_ATTEMPTS } from '../attempts'

const saved = { pw: process.env.ADMIN_PASSWORD, cron: process.env.CRON_SECRET }

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'correct horse battery staple'
  process.env.CRON_SECRET = 'cron-secret'
})
afterEach(() => {
  process.env.ADMIN_PASSWORD = saved.pw
  process.env.CRON_SECRET = saved.cron
  if (saved.pw === undefined) delete process.env.ADMIN_PASSWORD
  if (saved.cron === undefined) delete process.env.CRON_SECRET
})

describe('admin tokens', () => {
  it('accepts a fresh token and refuses it once expired', async () => {
    const now = 1_800_000_000_000
    const token = await createAdminToken(now)
    expect(await verifyAdminToken(token, now)).toBe(true)
    expect(await verifyAdminToken(token, now + ADMIN_SESSION_MS - 1000)).toBe(true)
    expect(await verifyAdminToken(token, now + ADMIN_SESSION_MS)).toBe(false)
  })

  it('refuses a token whose expiry was edited', async () => {
    const now = 1_800_000_000_000
    const [, sig] = (await createAdminToken(now)).split('.')
    expect(await verifyAdminToken(`${now + ADMIN_SESSION_MS * 10}.${sig}`, now)).toBe(false)
    expect(await verifyAdminToken(`${now + ADMIN_SESSION_MS - 5}.${sig}`, now)).toBe(false)
  })

  it('refuses junk', async () => {
    for (const t of [null, undefined, '', 'abc', '.', '123.', 'NaN.ab', '0.00']) {
      expect(await verifyAdminToken(t)).toBe(false)
    }
  })

  it('signs everyone out when the password or cron secret changes', async () => {
    const now = Date.now()
    const token = await createAdminToken(now)
    process.env.ADMIN_PASSWORD = 'a different one'
    expect(await verifyAdminToken(token, now)).toBe(false)
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    process.env.CRON_SECRET = 'rotated'
    expect(await verifyAdminToken(token, now)).toBe(false)
  })

  it('keeps admin shut when no password is set', async () => {
    const token = await createAdminToken()
    delete process.env.ADMIN_PASSWORD
    expect(adminConfigured()).toBe(false)
    expect(await verifyAdminToken(token)).toBe(false)
    await expect(createAdminToken()).rejects.toThrow()
  })
})

describe('admin login attempts', () => {
  it('locks out after the fifth wrong password and opens again after the window', () => {
    let state = null
    const t0 = 1_000_000
    for (let i = 0; i < MAX_ADMIN_ATTEMPTS; i++) {
      expect(isLockedOut(state, t0)).toBe(false)
      state = afterFailedAttempt(state, t0 + i)
    }
    expect(isLockedOut(state, t0 + 10)).toBe(true)
    expect(isLockedOut(state, t0 + ADMIN_ATTEMPT_WINDOW_MS + 1)).toBe(false)
    expect(afterFailedAttempt(state, t0 + ADMIN_ATTEMPT_WINDOW_MS + 1)).toEqual({ count: 1, since: t0 + ADMIN_ATTEMPT_WINDOW_MS + 1 })
  })
})
