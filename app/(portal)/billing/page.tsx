import { redirect } from 'next/navigation'

// Billing has been merged into the Account page. This route is kept as a
// permanent redirect so any old bookmarks or links to /billing still work.
export default function BillingPage() {
  redirect('/account')
}
