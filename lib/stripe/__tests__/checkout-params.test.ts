import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

// Set before the params are built (at collection time, below).
process.env.STRIPE_PRICE_ID = 'price_test'

const { buildCheckoutSessionParams } = await import('../billing')

describe('buildCheckoutSessionParams', () => {
  const params = buildCheckoutSessionParams('cus_1', 'user-1', 'https://www.housepost.co.uk')

  it('keeps everything the webhook and billing rely on', () => {
    expect(params.customer).toBe('cus_1')
    expect(params.mode).toBe('subscription')
    expect(params.line_items).toEqual([{ price: 'price_test', quantity: 1 }])
    expect(params.success_url).toBe('https://www.housepost.co.uk/billing?checkout=success')
    expect(params.cancel_url).toBe('https://www.housepost.co.uk/billing?checkout=cancelled')
    expect(params.metadata).toEqual({ userId: 'user-1' })
    expect(params.subscription_data?.metadata).toEqual({ userId: 'user-1' })
  })

  it('applies the Checkout Studio settings', () => {
    expect(params).toMatchObject({
      billing_address_collection: 'required',
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      payment_method_collection: 'always',
      submit_type: 'auto',
      name_collection: {
        individual: { enabled: true, optional: true },
        business: { enabled: true },
      },
      saved_payment_method_options: { payment_method_save: 'enabled' },
      origin_context: 'web',
      customer_update: { address: 'auto', name: 'auto' },
    })
  })

  it('only takes cards, so paid postcards can be charged off-session', () => {
    expect(params.payment_method_types).toEqual(['card'])
  })

  it('holds back the terms tick box until /terms is live', () => {
    expect(params.consent_collection).toBeUndefined()
  })

  it('leaves ui_mode at Stripe’s hosted default', () => {
    expect(params.ui_mode).toBeUndefined()
  })
})
