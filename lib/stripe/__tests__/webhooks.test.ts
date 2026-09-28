import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// ── A small in-memory stand-in for the Supabase admin client ────────────────
// Supports just the query shapes the webhook handlers use: select/update with
// eq, is, ilike, or, limit and maybeSingle, plus auth.admin.getUserById.

type Row = Record<string, unknown>
type AuthUser = { email: string; email_confirmed_at: string | null }

// SQL LIKE (with backslash escapes) to a case-insensitive RegExp, for ilike.
function likeToRegExp(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\' && i + 1 < pattern.length) {
      out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    } else if (ch === '%') out += '.*'
    else if (ch === '_') out += '.'
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}

function fakeSupabase(rows: Row[], users: Record<string, AuthUser> = {}) {
  const from = () => {
    let op: 'select' | 'update' = 'select'
    let values: Row = {}
    let limitN = Infinity
    const filters: ((r: Row) => boolean)[] = []
    const run = () => {
      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        for (const r of matched) Object.assign(r, values)
        return { data: null, error: null }
      }
      return { data: matched.slice(0, limitN), error: null }
    }
    const api = {
      select: () => api,
      update: (v: Row) => {
        op = 'update'
        values = v
        return api
      },
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val)
        return api
      },
      is: (col: string, val: unknown) => {
        filters.push((r) => (r[col] ?? null) === val)
        return api
      },
      ilike: (col: string, pattern: string) => {
        const re = likeToRegExp(pattern)
        filters.push((r) => re.test(String(r[col] ?? '')))
        return api
      },
      // Only the "a.is.null,a.eq.x" shape the delete handler sends.
      or: (expr: string) => {
        const alternatives = expr.split(',').map((part) => {
          const [col, operator, ...rest] = part.split('.')
          const val = rest.join('.')
          return (r: Row) =>
            operator === 'is' ? (r[col] ?? null) === null : r[col] === val
        })
        filters.push((r) => alternatives.some((f) => f(r)))
        return api
      },
      limit: (n: number) => {
        limitN = n
        return api
      },
      maybeSingle: () => {
        const { data } = run() as { data: Row[] }
        return Promise.resolve({ data: data[0] ?? null, error: null })
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    }
    return api
  }
  return {
    from,
    auth: {
      admin: {
        getUserById: async (id: string) =>
          users[id]
            ? { data: { user: { id, ...users[id] } }, error: null }
            : { data: { user: null }, error: { status: 404, message: 'User not found' } },
      },
    },
  }
}

// ── Module mocks ─────────────────────────────────────────────────────────────
let currentClient: ReturnType<typeof fakeSupabase>
const retrieveCustomer = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => currentClient }))
vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({ customers: { retrieve: retrieveCustomer } }),
}))

const {
  findProfileForSubscription,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} = await import('../webhooks')

function sub(overrides: Partial<Stripe.Subscription> & { id?: string } = {}): Stripe.Subscription {
  return {
    id: 'sub_new',
    customer: 'cus_1',
    status: 'active',
    metadata: {},
    items: {
      data: [{ current_period_start: 1790000000, current_period_end: 1792600000 }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription
}

const CONFIRMED = '2026-03-04T10:19:00Z'

beforeEach(() => {
  retrieveCustomer.mockReset()
  retrieveCustomer.mockResolvedValue({ id: 'cus_1', email: null })
})

// ── findProfileForSubscription ───────────────────────────────────────────────
describe('findProfileForSubscription', () => {
  it('uses metadata.userId when the subscription has one', async () => {
    const db = fakeSupabase([{ id: 'u-other', stripe_customer_id: 'cus_1' }])
    const match = await findProfileForSubscription(db as never, sub({ metadata: { userId: 'u-meta' } }))
    expect(match).toEqual({ userId: 'u-meta', matchedBy: 'metadata' })
  })

  it('falls back to the profile that holds the Stripe customer id', async () => {
    const db = fakeSupabase([{ id: 'u1', stripe_customer_id: 'cus_1', email: 'a@x.com' }])
    const getEmail = vi.fn()
    const match = await findProfileForSubscription(db as never, sub(), getEmail)
    expect(match).toEqual({ userId: 'u1', matchedBy: 'customer' })
    expect(getEmail).not.toHaveBeenCalled()
  })

  it('then matches one confirmed profile by email, ignoring case', async () => {
    const db = fakeSupabase(
      [{ id: 'u1', stripe_customer_id: null, email: 'Tester@Example.com' }],
      { u1: { email: 'tester@example.com', email_confirmed_at: CONFIRMED } }
    )
    const match = await findProfileForSubscription(db as never, sub(), async () => 'TESTER@example.com ')
    expect(match).toEqual({ userId: 'u1', matchedBy: 'email' })
  })

  it('treats _ and % in an email literally', async () => {
    const db = fakeSupabase(
      [{ id: 'u1', stripe_customer_id: null, email: 'axb@x.com' }],
      { u1: { email: 'axb@x.com', email_confirmed_at: CONFIRMED } }
    )
    expect(await findProfileForSubscription(db as never, sub(), async () => 'a_b@x.com')).toBeNull()
    expect(await findProfileForSubscription(db as never, sub(), async () => '%@x.com')).toBeNull()
  })

  it('refuses an email shared by two profiles', async () => {
    const db = fakeSupabase(
      [
        { id: 'u1', stripe_customer_id: null, email: 'same@x.com' },
        { id: 'u2', stripe_customer_id: null, email: 'same@x.com' },
      ],
      {
        u1: { email: 'same@x.com', email_confirmed_at: CONFIRMED },
        u2: { email: 'same@x.com', email_confirmed_at: CONFIRMED },
      }
    )
    expect(await findProfileForSubscription(db as never, sub(), async () => 'same@x.com')).toBeNull()
  })

  it('refuses an unconfirmed email', async () => {
    const db = fakeSupabase(
      [{ id: 'u1', stripe_customer_id: null, email: 'a@x.com' }],
      { u1: { email: 'a@x.com', email_confirmed_at: null } }
    )
    expect(await findProfileForSubscription(db as never, sub(), async () => 'a@x.com')).toBeNull()
  })

  it('refuses when the login email no longer matches the profile email', async () => {
    const db = fakeSupabase(
      [{ id: 'u1', stripe_customer_id: null, email: 'old@x.com' }],
      { u1: { email: 'new@x.com', email_confirmed_at: CONFIRMED } }
    )
    expect(await findProfileForSubscription(db as never, sub(), async () => 'old@x.com')).toBeNull()
  })

  it('matches nothing when the Stripe customer has no email', async () => {
    const db = fakeSupabase([{ id: 'u1', stripe_customer_id: null, email: 'a@x.com' }])
    expect(await findProfileForSubscription(db as never, sub(), async () => null)).toBeNull()
  })
})

// ── handleSubscriptionUpdated ────────────────────────────────────────────────
describe('handleSubscriptionUpdated', () => {
  it('activates a hand-made subscription matched by email and records its customer', async () => {
    const profile: Row = { id: 'u1', email: 'a@x.com', stripe_customer_id: null, stripe_subscription_id: null, subscription_status: 'incomplete' }
    currentClient = fakeSupabase([profile], { u1: { email: 'a@x.com', email_confirmed_at: CONFIRMED } })
    retrieveCustomer.mockResolvedValue({ id: 'cus_1', email: 'a@x.com' })

    await handleSubscriptionUpdated(sub())

    expect(profile.subscription_status).toBe('active')
    expect(profile.stripe_subscription_id).toBe('sub_new')
    expect(profile.stripe_customer_id).toBe('cus_1')
    expect(profile.subscription_period_end).toBe(new Date(1792600000 * 1000).toISOString())
  })

  it('never repoints a profile that already has a different customer', async () => {
    const profile: Row = { id: 'u1', email: 'a@x.com', stripe_customer_id: 'cus_old', stripe_subscription_id: null }
    currentClient = fakeSupabase([profile], { u1: { email: 'a@x.com', email_confirmed_at: CONFIRMED } })
    retrieveCustomer.mockResolvedValue({ id: 'cus_1', email: 'a@x.com' })

    await handleSubscriptionUpdated(sub())

    expect(profile.subscription_status).toBe('active')
    expect(profile.stripe_customer_id).toBe('cus_old')
  })

  it('leaves the customer id alone on a normal metadata match', async () => {
    const profile: Row = { id: 'u1', stripe_customer_id: null, stripe_subscription_id: null }
    currentClient = fakeSupabase([profile])

    await handleSubscriptionUpdated(sub({ metadata: { userId: 'u1' } }))

    expect(profile.subscription_status).toBe('active')
    expect(profile.stripe_customer_id).toBeNull()
  })

  it('ignores a non-live subscription when the profile is on another one', async () => {
    const profile: Row = { id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_current', subscription_status: 'active' }
    currentClient = fakeSupabase([profile])

    await handleSubscriptionUpdated(sub({ id: 'sub_old', status: 'past_due' }))

    expect(profile.stripe_subscription_id).toBe('sub_current')
    expect(profile.subscription_status).toBe('active')
  })

  it('moves the profile onto a new live subscription', async () => {
    const profile: Row = { id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_old', subscription_status: 'canceled' }
    currentClient = fakeSupabase([profile])

    await handleSubscriptionUpdated(sub({ id: 'sub_new', status: 'active' }))

    expect(profile.stripe_subscription_id).toBe('sub_new')
    expect(profile.subscription_status).toBe('active')
  })

  it('does nothing when nothing matches', async () => {
    const profile: Row = { id: 'u1', stripe_customer_id: 'cus_other', subscription_status: 'incomplete' }
    currentClient = fakeSupabase([profile])

    await handleSubscriptionUpdated(sub())

    expect(profile.subscription_status).toBe('incomplete')
  })
})

// ── handleSubscriptionDeleted ────────────────────────────────────────────────
describe('handleSubscriptionDeleted', () => {
  it('cancels the profile when this is its subscription', async () => {
    const profile: Row = { id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_x', subscription_status: 'active' }
    currentClient = fakeSupabase([profile])

    await handleSubscriptionDeleted(sub({ id: 'sub_x', status: 'canceled' }))

    expect(profile.subscription_status).toBe('canceled')
  })

  it('cancels a profile with no subscription recorded', async () => {
    const profile: Row = { id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: null, subscription_status: 'active' }
    currentClient = fakeSupabase([profile])

    await handleSubscriptionDeleted(sub({ id: 'sub_x', status: 'canceled' }))

    expect(profile.subscription_status).toBe('canceled')
  })

  it('does not cancel a profile that has moved to a newer subscription', async () => {
    const profile: Row = { id: 'u1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_new', subscription_status: 'active' }
    currentClient = fakeSupabase([profile])

    await handleSubscriptionDeleted(sub({ id: 'sub_old', status: 'canceled' }))

    expect(profile.subscription_status).toBe('active')
  })
})
