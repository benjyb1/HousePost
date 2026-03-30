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
