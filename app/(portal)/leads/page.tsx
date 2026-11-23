import { redirect } from 'next/navigation'

// Leads now live on Home (the list, the map and the checkout together).
// Kept so links in emails and notifications to /leads still land somewhere.
export default function LeadsPage() {
  redirect('/dashboard')
}
