export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

export interface Profile {
  id: string
  fullName: string
  email: string
  officePostcode: string
  officeLat: number | null
  officeLng: number | null
  searchRadiusMiles: number
  minPrice: number | null
  maxPrice: number | null
  propertyTypes: string[]
  postcardDesignUrl: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus
  subscriptionPeriodEnd: string | null
  postcardsUsedThisPeriod: number
  currentPeriodStart: string | null
  createdAt: string
  updatedAt: string
}

export const INCLUDED_POSTCARDS_PER_MONTH = 5
export const POSTCARD_OVERAGE_PENCE = 150 // £1.50

// Hard spending cap: a user may not send more than this many postcards in a
// single billing period. 5 are included free, up to 45 more are paid at
// POSTCARD_OVERAGE_PENCE each, and 50 is an absolute stop — enforced both in the
// send route and at the database level (see increment_postcards_used_capped).
export const MONTHLY_POSTCARD_CAP = 50

// How long a confirmed send is held before it is posted, giving the user a
// window to cancel and be refunded (feature 6.4). Kept here so the API route and
// any UI copy stay in sync.
export const POSTCARD_COOL_OFF_MINUTES = 15
