import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    // Pin the API version to the one this SDK (v20) was built for, so reading
    // current_period_end off items.data[0] stays correct regardless of the
    // account's default version in the Stripe dashboard.
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    })
  }
  return _stripe
}
